import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { addDays, endOfDay, formatDistanceToNowStrict, isBefore, isSameDay, isThisMonth, isThisWeek, parseISO, startOfToday } from 'date-fns'
import { Search, Bell, HelpCircle, Sun, Moon, Menu, X, Filter, CheckSquare, Target, FileText, Repeat, Tag, AlertOctagon, Clock3, CalendarClock, RefreshCw, Database, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useStore } from '@/store'
import { useElectron } from '@/hooks/use-electron'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { useTodayAnalyticsProductivity } from '@/hooks/use-today-analytics-productivity'
import { database, getLocalDateString, type Review } from '@/lib/database'
import { isTaskPausedOnDate } from '@/lib/daily-reset'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

interface SearchResult {
  id: string
  type: 'task' | 'habit' | 'goal' | 'note'
  title: string
  status?: string
  tags?: string[]
  priority?: string
}

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  type: string
  mood?: string
  created_at: string
  updated_at: string
}

type AlertPriority = 'critical' | 'high' | 'medium'
type AlertCategory = 'tasks' | 'habits' | 'goals' | 'reviews' | 'sync' | 'backup' | 'system'

interface HeaderNotificationItem {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  read: boolean
  priority: AlertPriority
  category: AlertCategory
  route?: string
  source: 'store' | 'derived'
  sortKey: number
}

const PRIORITY_RANK: Record<AlertPriority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
}

const toDateSafe = (value: string | null | undefined): Date | null => {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }
  const parsed = parseISO(value)
  if (!Number.isNaN(parsed.getTime())) return parsed
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

const relativeTime = (value: string | null | undefined): string => {
  const parsed = toDateSafe(value)
  if (!parsed) return 'Now'
  return `${formatDistanceToNowStrict(parsed, { addSuffix: true })}`
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isCurrentPeriodReviewCompleted = (review: Review | null | undefined, type: 'daily' | 'weekly' | 'monthly') => {
  if (!review || review.status !== 'completed') return false
  const periodDate = toDateSafe(review.period_end)
  if (!periodDate) return false
  if (type === 'daily') return isSameDay(periodDate, new Date())
  if (type === 'weekly') return isThisWeek(periodDate, { weekStartsOn: 1 })
  return isThisMonth(periodDate)
}

const toDayKey = (value: string | null | undefined): string => {
  if (!value) return getLocalDateString(new Date())
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = toDateSafe(value)
  return parsed ? getLocalDateString(parsed) : getLocalDateString(new Date(value))
}

const isSkippedOrEmptyEntry = (entry: { progress?: number | null; status?: string | null }): boolean => {
  const status = entry.status || 'pending'
  const progress = entry.progress ?? 0
  return status === 'skipped' || (progress <= 0 && status !== 'completed')
}

const isTaskOverdueForToday = (task: any, todayKey: string): boolean => {
  if (!task?.due_date) return false

  const dueKey = toDayKey(task.due_date)
  if (dueKey >= todayKey) return false

  const createdKey = toDayKey(task.created_at)
  if (createdKey > dueKey) return false
  if ((task.duration_type || 'today') !== 'continuous' && createdKey !== dueKey) return false

  if (isTaskPausedOnDate(task, parseISO(`${dueKey}T00:00:00`))) return false

  const dayState = task.daily_progress?.[dueKey]
  const status = dayState?.status ?? 'pending'
  const progress = dayState?.progress ?? 0

  return isSkippedOrEmptyEntry({ status, progress })
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const electron = useElectron()
  const { theme, setTheme } = useTheme()
  const {
    notifications,
    userProfile,
    habits,
    goals,
    syncEnabled,
    syncInterval,
    lastSync,
    syncStatus,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    tasks,
  } = useStore()
  const todayProductivity = useTodayAnalyticsProductivity()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [latestAppUpdate, setLatestAppUpdate] = useState<any | null>(null)
  const appUpdateSubscribed = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const todayLocalKey = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = `${now.getMonth() + 1}`.padStart(2, '0')
    const day = `${now.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const unreadStoreNotifications = notifications.filter(n => !n.read).length

  const handleToggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])
  
  // Fetch notes for search
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['notes-for-search'],
    queryFn: async () => {
      try {
        const notesData = await electron.executeQuery<Note[]>(`
          SELECT id, title, content, tags, type, mood, created_at, updated_at
          FROM notes
          WHERE deleted_at IS NULL
          ORDER BY updated_at DESC
        `)
        return (Array.isArray(notesData) ? notesData : []).map((note: any) => {
          let tags: string[] = []
          try {
            tags = typeof note.tags === 'string' ? JSON.parse(note.tags || '[]') : note.tags
          } catch {
            tags = []
          }
          return { ...note, tags: Array.isArray(tags) ? tags : [] }
        })
      } catch (error) {
        console.error('Failed to fetch notes for search:', error)
        return []
      }
    },
    enabled: electron.isReady,
    staleTime: 30000, // Cache for 30 seconds
  })

  const { data: latestReviews } = useQuery<{ daily: Review | null; weekly: Review | null; monthly: Review | null }>({
    queryKey: ['header-latest-reviews'],
    queryFn: async () => {
      const [daily, weekly, monthly] = await Promise.all([
        database.getLatestReview('daily'),
        database.getLatestReview('weekly'),
        database.getLatestReview('monthly'),
      ])
      return { daily, weekly, monthly }
    },
    enabled: electron.isReady,
    staleTime: 30000,
    refetchInterval: 60000,
  })

  const { data: todayHabitCompletions = [] } = useQuery<Array<{ habit_id: string; completed: boolean }>>({
    queryKey: ['header-habit-completions', todayLocalKey],
    queryFn: async () => {
      const completions = await database.getHabitCompletions(todayLocalKey, todayLocalKey)
      return Array.isArray(completions) ? completions : []
    },
    enabled: electron.isReady,
    staleTime: 20000,
    refetchInterval: 60000,
  })

  const { data: backupStats } = useQuery<any>({
    queryKey: ['header-backup-stats'],
    queryFn: async () => {
      if (!electron.isReady) return null
      return electron.getBackupStats()
    },
    enabled: electron.isReady,
    staleTime: 30000,
    refetchInterval: 60000,
  })

  useEffect(() => {
    const electronApi = window.electronAPI as any
    if (!electron.isReady || !electronApi?.onAppUpdate || appUpdateSubscribed.current) return
    const handler = (_event: unknown, update: any) => {
      setLatestAppUpdate(update)
    }
    electronApi.onAppUpdate(handler)
    appUpdateSubscribed.current = true
  }, [electron.isReady])

  const derivedNotifications = useMemo<HeaderNotificationItem[]>(() => {
    const now = new Date()
    const todayStart = startOfToday()
    const todayEnd = endOfDay(todayStart)
    const upcomingWindowEnd = addDays(todayStart, 1)

    const activeTasks = tasks.filter((task: any) => !task.deleted_at)
    const overdueTasks = activeTasks.filter((task: any) => {
      if ((task.progress || 0) === 100 || task.status === 'completed') return false
      return isTaskOverdueForToday(task, todayLocalKey)
    })
    const dueSoonTasks = activeTasks.filter((task: any) => {
      if (!task.due_date || task.status === 'completed' || task.status === 'skipped') return false
      const due = toDateSafe(task.due_date)
      return !!due && due >= todayStart && due <= upcomingWindowEnd
    })
    const dueTodayTasks = activeTasks.filter((task: any) => {
      if (!task.due_date || task.status === 'completed' || task.status === 'skipped') return false
      const due = toDateSafe(task.due_date)
      return !!due && due >= todayStart && due <= todayEnd
    })

    // Helper function to create priority breakdown message
    const getPriorityBreakdown = (taskList: any[]) => {
      const highPriority = taskList.filter((t: any) => t.priority === 'high').length
      const mediumPriority = taskList.filter((t: any) => t.priority === 'medium').length
      const lowPriority = taskList.filter((t: any) => t.priority === 'low').length
      const parts = []
      if (highPriority > 0) parts.push(`${highPriority} high`)
      if (mediumPriority > 0) parts.push(`${mediumPriority} medium`)
      if (lowPriority > 0) parts.push(`${lowPriority} low`)
      return parts.length > 0 ? ` (${parts.join(', ')})` : ''
    }

    const blockedTasks = activeTasks.filter((task: any) => task.status === 'blocked')

    const activeGoals = goals.filter((goal: any) => !goal.deleted_at && goal.status === 'active')
    const atRiskGoals = activeGoals.filter((goal: any) => {
      if (!goal.target_date || (goal.progress ?? 0) >= 100) return false
      const target = toDateSafe(goal.target_date)
      return !!target && target >= todayStart && target <= addDays(todayStart, 7)
    })

    const todayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayOfMonth = `${now.getDate()}`
    const completedHabitIds = new Set(
      todayHabitCompletions.filter((completion) => completion.completed).map((completion) => completion.habit_id)
    )
    const dueTodayHabits = habits.filter((habit: any) => {
      if (habit.deleted_at) return false
      if (habit.frequency === 'daily') return true
      if (habit.frequency === 'weekly') {
        return Array.isArray(habit.schedule)
          ? habit.schedule.some((entry: string) => String(entry).toLowerCase() === todayName)
          : false
      }
      if (habit.frequency === 'monthly') {
        return Array.isArray(habit.schedule)
          ? habit.schedule.some((entry: string) => String(entry) === dayOfMonth)
          : false
      }
      return false
    })
    const incompleteDueHabits = dueTodayHabits.filter((habit: any) => !completedHabitIds.has(habit.id))

    const pendingDailyReview = !isCurrentPeriodReviewCompleted(latestReviews?.daily, 'daily')
    const pendingWeeklyReview = !isCurrentPeriodReviewCompleted(latestReviews?.weekly, 'weekly')
    const pendingMonthlyReview = !isCurrentPeriodReviewCompleted(latestReviews?.monthly, 'monthly')

    const syncStaleMinutes = lastSync ? Math.round((Date.now() - new Date(lastSync).getTime()) / 60000) : null
    const syncStaleThreshold = Math.max(syncInterval * 3, 30)

    const alerts: HeaderNotificationItem[] = []

    if (overdueTasks.length > 0) {
      alerts.push({
        id: 'critical-overdue-tasks',
        title: 'Overdue Tasks',
        message: `${overdueTasks.length} task${overdueTasks.length === 1 ? '' : 's'} became overdue yesterday${getPriorityBreakdown(overdueTasks)}`,
        type: 'error',
        time: 'Yesterday',
        read: false,
        priority: 'critical',
        category: 'tasks',
        route: '/tasks',
        source: 'derived',
        sortKey: Date.now(),
      })
    }

    if (blockedTasks.length > 0) {
      alerts.push({
        id: 'high-blocked-tasks',
        title: 'Blocked Tasks',
        message: `${blockedTasks.length} blocked task${blockedTasks.length === 1 ? '' : 's'} slowing progress${getPriorityBreakdown(blockedTasks)}`,
        type: 'warning',
        time: 'Now',
        read: false,
        priority: 'high',
        category: 'tasks',
        route: '/tasks',
        source: 'derived',
        sortKey: Date.now() - 1,
      })
    }

    if (dueSoonTasks.length > 0) {
      alerts.push({
        id: 'high-due-soon',
        title: 'Upcoming Deadlines',
        message: `${dueSoonTasks.length} task${dueSoonTasks.length === 1 ? '' : 's'} due within 24 hours${getPriorityBreakdown(dueSoonTasks)}`,
        type: 'warning',
        time: 'Soon',
        read: false,
        priority: 'high',
        category: 'tasks',
        route: '/tasks',
        source: 'derived',
        sortKey: Date.now() - 2,
      })
    }

    if (dueTodayTasks.length > 0) {
      alerts.push({
        id: 'medium-due-today',
        title: 'Task Reminders',
        message: `${dueTodayTasks.length} task${dueTodayTasks.length === 1 ? '' : 's'} due today${getPriorityBreakdown(dueTodayTasks)}`,
        type: 'info',
        time: 'Today',
        read: false,
        priority: 'medium',
        category: 'tasks',
        route: '/tasks',
        source: 'derived',
        sortKey: Date.now() - 3,
      })
    }

    if (incompleteDueHabits.length > 0) {
      alerts.push({
        id: 'medium-habit-reminders',
        title: 'Habit Reminders',
        message: `${incompleteDueHabits.length} scheduled habit${incompleteDueHabits.length === 1 ? '' : 's'} still pending today.`,
        type: 'info',
        time: 'Today',
        read: false,
        priority: 'medium',
        category: 'habits',
        route: '/habits',
        source: 'derived',
        sortKey: Date.now() - 4,
      })
    }

    if (atRiskGoals.length > 0) {
      alerts.push({
        id: 'high-goal-deadlines',
        title: 'Goal Deadlines Approaching',
        message: `${atRiskGoals.length} active goal${atRiskGoals.length === 1 ? '' : 's'} due within 7 days.`,
        type: 'warning',
        time: 'This week',
        read: false,
        priority: 'high',
        category: 'goals',
        route: '/goals',
        source: 'derived',
        sortKey: Date.now() - 5,
      })
    }

    if (pendingDailyReview) {
      alerts.push({
        id: 'high-review-daily',
        title: 'Daily Review Pending',
        message: 'Your daily reflection is not completed yet.',
        type: 'warning',
        time: 'Today',
        read: false,
        priority: 'high',
        category: 'reviews',
        route: '/reviews',
        source: 'derived',
        sortKey: Date.now() - 6,
      })
    }

    if (pendingWeeklyReview) {
      alerts.push({
        id: 'high-review-weekly',
        title: 'Weekly Review Pending',
        message: 'Weekly review for this week is still pending.',
        type: 'warning',
        time: 'This week',
        read: false,
        priority: 'high',
        category: 'reviews',
        route: '/reviews',
        source: 'derived',
        sortKey: Date.now() - 7,
      })
    }

    if (pendingMonthlyReview) {
      alerts.push({
        id: 'high-review-monthly',
        title: 'Monthly Review Pending',
        message: 'Monthly review for this month is still pending.',
        type: 'warning',
        time: 'This month',
        read: false,
        priority: 'high',
        category: 'reviews',
        route: '/reviews',
        source: 'derived',
        sortKey: Date.now() - 8,
      })
    }

    if (syncEnabled && syncStatus === 'error') {
      alerts.push({
        id: 'critical-sync-error',
        title: 'Sync Error',
        message: 'Cloud sync is failing. Check sync settings and connectivity.',
        type: 'error',
        time: 'Now',
        read: false,
        priority: 'critical',
        category: 'sync',
        route: '/settings?tab=sync',
        source: 'derived',
        sortKey: Date.now() - 9,
      })
    }

    if (syncEnabled && syncStaleMinutes !== null && syncStaleMinutes > syncStaleThreshold) {
      alerts.push({
        id: 'high-sync-stale',
        title: 'Sync Delayed',
        message: `Last successful sync was ${syncStaleMinutes} minutes ago.`,
        type: 'warning',
        time: lastSync ? relativeTime(lastSync as any) : 'Unknown',
        read: false,
        priority: 'high',
        category: 'sync',
        route: '/settings?tab=sync',
        source: 'derived',
        sortKey: Date.now() - 10,
      })
    }

    if (backupStats?.missingBackups > 0) {
      alerts.push({
        id: 'critical-backup-missing',
        title: 'Backup Integrity Issue',
        message: `${backupStats.missingBackups} backup file${backupStats.missingBackups === 1 ? '' : 's'} missing or inaccessible.`,
        type: 'error',
        time: 'Now',
        read: false,
        priority: 'critical',
        category: 'backup',
        route: '/backup',
        source: 'derived',
        sortKey: Date.now() - 11,
      })
    }

    if (backupStats && backupStats.totalBackups === 0) {
      alerts.push({
        id: 'high-backup-none',
        title: 'No Backups Found',
        message: 'Create a backup to protect your data.',
        type: 'warning',
        time: 'Now',
        read: false,
        priority: 'high',
        category: 'backup',
        route: '/backup',
        source: 'derived',
        sortKey: Date.now() - 12,
      })
    }

    if (backupStats?.newestBackup) {
      const newestBackupDate = toDateSafe(backupStats.newestBackup)
      if (newestBackupDate && isBefore(newestBackupDate, addDays(todayStart, -7))) {
        alerts.push({
          id: 'high-backup-stale',
          title: 'Backup Outdated',
          message: `Last backup was ${relativeTime(backupStats.newestBackup)}.`,
          type: 'warning',
          time: relativeTime(backupStats.newestBackup),
          read: false,
          priority: 'high',
          category: 'backup',
          route: '/backup',
          source: 'derived',
          sortKey: Date.now() - 13,
        })
      }
    }

    if (latestAppUpdate?.type === 'available') {
      alerts.push({
        id: `system-update-available-${latestAppUpdate.version || 'unknown'}`,
        title: 'Major System Update Available',
        message: `Version ${latestAppUpdate.version || 'new'} is available to download.`,
        type: 'info',
        time: 'Now',
        read: false,
        priority: 'high',
        category: 'system',
        source: 'derived',
        sortKey: Date.now() - 14,
      })
    }

    if (latestAppUpdate?.type === 'downloaded') {
      alerts.push({
        id: `system-update-ready-${latestAppUpdate.version || 'unknown'}`,
        title: 'System Update Ready',
        message: `Version ${latestAppUpdate.version || 'new'} downloaded. Restart to install.`,
        type: 'success',
        time: 'Now',
        read: false,
        priority: 'high',
        category: 'system',
        source: 'derived',
        sortKey: Date.now() - 15,
      })
    }

    if (latestAppUpdate?.type === 'error') {
      alerts.push({
        id: 'system-update-error',
        title: 'System Update Error',
        message: latestAppUpdate.error || 'Failed to check/download updates.',
        type: 'error',
        time: 'Now',
        read: false,
        priority: 'high',
        category: 'system',
        source: 'derived',
        sortKey: Date.now() - 16,
      })
    }

    return alerts
  }, [tasks, goals, habits, todayHabitCompletions, latestReviews, syncEnabled, syncStatus, syncInterval, lastSync, backupStats, latestAppUpdate])

  const dropdownNotifications = useMemo<HeaderNotificationItem[]>(() => {
    const mappedStore: HeaderNotificationItem[] = notifications.map((notification, index) => ({
      id: `store-${notification.id}`,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      time: notification.time || 'Now',
      read: notification.read,
      priority:
        notification.type === 'error'
          ? 'critical' as AlertPriority
          : notification.type === 'warning'
            ? 'high' as AlertPriority
            : 'medium' as AlertPriority,
      category: 'system' as const,
      route: notification.type === 'error' ? '/settings?tab=notifications' : undefined,
      source: 'store' as const,
      sortKey: Date.now() - (index + 200),
    }))

    return [...derivedNotifications, ...mappedStore]
      .sort((a, b) => {
        const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        if (a.read !== b.read) return a.read ? 1 : -1
        return b.sortKey - a.sortKey
      })
      .slice(0, 12)
  }, [derivedNotifications, notifications])

  const unreadNotifications = dropdownNotifications.filter((notification) => !notification.read).length

  const handleNotificationClick = useCallback((notification: HeaderNotificationItem) => {
    if (notification.source === 'store') {
      const originalId = notification.id.replace(/^store-/, '')
      if (originalId) {
        markAsRead(originalId)
      }
    }

    if (notification.route) {
      navigate(notification.route)
    }
  }, [markAsRead, navigate])

  const renderNotificationIcon = useCallback((notification: HeaderNotificationItem) => {
    if (notification.priority === 'critical') {
      return <AlertOctagon className="h-4 w-4 text-destructive" />
    }
    if (notification.category === 'sync') {
      return <RefreshCw className="h-4 w-4 text-yellow-500" />
    }
    if (notification.category === 'backup') {
      return <Database className="h-4 w-4 text-orange-500" />
    }
    if (notification.category === 'tasks' || notification.category === 'reviews') {
      return <CalendarClock className="h-4 w-4 text-blue-500" />
    }
    if (notification.category === 'system') {
      return <Rocket className="h-4 w-4 text-green-500" />
    }
    return <Clock3 className="h-4 w-4 text-muted-foreground" />
  }, [])

  const renderPriorityBadge = useCallback((priority: AlertPriority) => {
    if (priority === 'critical') {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Critical</Badge>
    }
    if (priority === 'high') {
      return <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">High</Badge>
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Info</Badge>
  }, [])

  const actionButtonClass = 'h-9 w-9 transition-colors hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400'

  const breadcrumbs = useMemo(() => {
    const pathLabels: Record<string, string> = {
      '/': 'Dashboard',
      '/goals': 'Goals',
      '/tasks': 'Tasks',
      '/habits': 'Habits',
      '/notes': 'Notes',
      '/reviews': 'Reviews',
      '/analytics': 'Analytics',
      '/time': 'Time',
      '/archive': 'Archive',
      '/settings': 'Settings',
      '/backup': 'Backup & Restore',
      '/help-support': 'Help & Support',
    }

    const settingsTabLabels: Record<string, string> = {
      profile: 'Profile',
      notifications: 'Notifications',
      preferences: 'Preferences',
      data: 'Data Management',
      privacy: 'Privacy & Security',
      shortcuts: 'Keyboard Shortcuts',
      help: 'Help & Support',
      'help-support': 'Help & Support',
    }

    const items: Array<{ label: string; path?: string }> = [{ label: 'Progress OS' }]

    if (location.pathname === '/backup') {
      items.push({ label: 'Settings', path: '/settings' })
      items.push({ label: 'Backup & Restore' })
      return items
    }

    if (location.pathname === '/help-support') {
      items.push({ label: 'Settings', path: '/settings' })
      items.push({ label: 'Help & Support' })
      return items
    }

    const baseLabel = pathLabels[location.pathname] || 'Dashboard'
    items.push({ label: baseLabel, path: location.pathname === '/' ? undefined : location.pathname })

    if (location.pathname === '/settings') {
      const tab = new URLSearchParams(location.search).get('tab')
      if (tab && tab !== 'profile') {
        items.push({ label: settingsTabLabels[tab] || tab })
      }
    }

    return items
  }, [location.pathname, location.search])

  // Get user initials for avatar
  const userInitials = useMemo(() => {
    if (!userProfile.name) return 'U'
    return userProfile.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [userProfile.name])

  // Search results
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim()) return []
    
    const query = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []
    
    // Search tasks
    tasks.forEach(task => {
      const titleMatch = task.title?.toLowerCase().includes(query)
      const tagMatch = task.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      const statusMatch = task.status?.toLowerCase().includes(query)
      
      if (titleMatch || tagMatch || statusMatch) {
        results.push({
          id: task.id,
          type: 'task',
          title: task.title,
          status: task.status,
          tags: task.tags,
          priority: task.priority,
        })
      }
    })
    
    // Search habits
    habits.forEach(habit => {
      const titleMatch = habit.title?.toLowerCase().includes(query)
      const descMatch = habit.description?.toLowerCase().includes(query)
      const freqMatch = habit.frequency?.toLowerCase().includes(query)
      
      if (titleMatch || descMatch || freqMatch) {
        results.push({
          id: habit.id,
          type: 'habit',
          title: habit.title,
          status: habit.frequency,
        })
      }
    })
    
    // Search goals
    goals.forEach(goal => {
      const titleMatch = goal.title?.toLowerCase().includes(query)
      const descMatch = goal.description?.toLowerCase().includes(query)
      const tagMatch = goal.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      const categoryMatch = goal.category?.toLowerCase().includes(query)
      
      if (titleMatch || descMatch || tagMatch || categoryMatch) {
        results.push({
          id: goal.id,
          type: 'goal',
          title: goal.title,
          status: goal.status,
          tags: goal.tags,
          priority: goal.priority,
        })
      }
    })
    
    // Search notes
    notes.forEach(note => {
      const titleMatch = note.title?.toLowerCase().includes(query)
      const contentMatch = note.content?.toLowerCase().includes(query)
      const tagMatch = note.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      const typeMatch = note.type?.toLowerCase().includes(query)
      
      if (titleMatch || contentMatch || tagMatch || typeMatch) {
        results.push({
          id: note.id,
          type: 'note',
          title: note.title,
          status: note.type,
          tags: note.tags,
        })
      }
    })
    
    // Limit results and remove duplicates
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.id === result.id && r.type === result.type)
    )
    
    return uniqueResults.slice(0, 10)
  }, [searchQuery, tasks, habits, goals, notes])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchResults])

  // Handle navigation to result
  const handleSelectResult = useCallback((result: SearchResult) => {
    // Navigate to the appropriate page with the item ID in state
    switch (result.type) {
      case 'task':
        navigate('/tasks', { state: { highlightId: result.id } })
        break
      case 'habit':
        navigate('/habits', { state: { highlightId: result.id } })
        break
      case 'goal':
        navigate('/goals', { state: { highlightId: result.id } })
        break
      case 'note':
        navigate('/notes', { state: { highlightId: result.id } })
        break
    }
    
    // Clear search
    setSearchQuery('')
    setSearchOpen(false)
    searchInputRef.current?.blur()
  }, [navigate])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!searchResults.length) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % searchResults.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
        break
      case 'Enter':
        e.preventDefault()
        if (searchResults[selectedIndex]) {
          handleSelectResult(searchResults[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setSearchQuery('')
        setSearchOpen(false)
        searchInputRef.current?.blur()
        break
    }
  }, [searchResults, selectedIndex, handleSelectResult])

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && searchResults.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, searchResults.length])

  // Get icon for result type
  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'task':
        return <CheckSquare className="h-4 w-4 text-blue-500" />
      case 'habit':
        return <Repeat className="h-4 w-4 text-purple-500" />
      case 'goal':
        return <Target className="h-4 w-4 text-green-500" />
      case 'note':
        return <FileText className="h-4 w-4 text-orange-500" />
    }
  }

  // Get type label
  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'task': return 'Task'
      case 'habit': return 'Habit'
      case 'goal': return 'Goal'
      case 'note': return 'Note'
    }
  }

  const getTypeBadgeClass = (type: SearchResult['type']) => {
    switch (type) {
      case 'task':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30'
      case 'habit':
        return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/70 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30'
      case 'goal':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30'
      case 'note':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30'
    }
  }

  // Get status badge variant
  const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!status) return 'secondary'
    const s = status.toLowerCase()
    if (s === 'completed' || s === 'done') return 'default'
    if (s === 'active' || s === 'in-progress') return 'secondary'
    if (s === 'overdue' || s === 'paused') return 'destructive'
    return 'outline'
  }

  const getStatusBadgeClass = (status?: string) => {
    if (!status) return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700/80'
    const s = status.toLowerCase()

    if (s === 'completed' || s === 'done') {
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30'
    }
    if (s === 'active' || s === 'in-progress' || s === 'daily' || s === 'weekly' || s === 'monthly') {
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30'
    }
    if (s === 'overdue' || s === 'paused' || s === 'blocked') {
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30'
    }

    return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700/80'
  }

  const highlightSearchMatch = useCallback((value: string, query: string) => {
    const safeValue = value || ''
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return safeValue

    const regex = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig')
    const parts = safeValue.split(regex)

    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === normalizedQuery.toLowerCase()
      if (!isMatch) return <span key={`${part}-${index}`}>{part}</span>

      return (
        <span
          key={`${part}-${index}`}
          className="rounded-sm bg-green-500/20 px-0.5 font-semibold text-green-700 dark:bg-green-500/25 dark:text-green-300"
        >
          {part}
        </span>
      )
    })
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 dark:bg-zinc-900/95 dark:supports-[backdrop-filter]:bg-zinc-900/90 shadow-md shadow-black/8 dark:shadow-black/20">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-9 w-9 transition-colors hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
          >
            {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </Button>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center space-x-2 text-sm">
            {breadcrumbs.map((crumb, index) => {
              const isFirst = index === 0
              const isLast = index === breadcrumbs.length - 1
              const clickable = !isFirst && !isLast && !!crumb.path

              return (
                <div key={`${crumb.label}-${index}`} className="flex items-center space-x-2">
                  {index > 0 && <span className="text-muted-foreground">/</span>}
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => navigate(crumb.path!)}
                      className="text-muted-foreground hover:text-green-600 dark:hover:text-green-400 transition-colors"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={cn(isLast ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {crumb.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Center Section - Search */}
        <div className={cn(
          "absolute left-1/2 transform -translate-x-1/2 transition-all duration-300",
          searchOpen ? "w-[420px] opacity-100" : "w-64 opacity-90"
        )}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              ref={searchInputRef}
              placeholder="Search tasks, goals, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-12 bg-secondary/50 border border-green-500/20 focus-visible:ring-1 focus-visible:ring-green-500/50 focus-visible:border-green-500/40 dark:bg-zinc-800/50 dark:border-green-500/15"
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                // Delay closing to allow click on results
                setTimeout(() => {
                  if (!resultsRef.current?.contains(document.activeElement)) {
                    setSearchOpen(false)
                  }
                }, 150)
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-green-500/20 bg-secondary/50 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:inline-flex dark:bg-zinc-800/50 dark:border-green-500/15">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            
            {/* Search Results Dropdown */}
            {searchOpen && searchQuery.trim() && (
              <div 
                ref={resultsRef}
                className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-[0_18px_45px_-18px_rgba(15,23,42,0.35)] dark:shadow-[0_20px_55px_-22px_rgba(0,0,0,0.75)] ring-1 ring-slate-200/70 dark:ring-zinc-800/90 overflow-hidden z-50"
              >
                {searchResults.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto p-2">
                    {searchResults.map((result, index) => (
                      <div
                        key={`${result.type}-${result.id}`}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150",
                          index === selectedIndex 
                            ? "bg-emerald-50/85 text-foreground shadow-sm ring-1 ring-emerald-200/70 dark:bg-emerald-500/10 dark:ring-emerald-400/25"
                            : "hover:bg-slate-100/85 dark:hover:bg-zinc-900/80"
                        )}
                        onClick={() => handleSelectResult(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        {/* Type Icon */}
                        <div className="flex-shrink-0">
                          {getTypeIcon(result.type)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="font-medium truncate">{highlightSearchMatch(result.title, searchQuery)}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'h-5 flex-shrink-0 rounded-md px-1.5 py-0 text-[10px] font-semibold tracking-wide uppercase border-0',
                                getTypeBadgeClass(result.type)
                              )}
                            >
                              {getTypeLabel(result.type)}
                            </Badge>
                          </div>
                          
                          {/* Status and Tags */}
                          <div className="mt-1 flex items-center gap-2">
                            {result.status && (
                              <Badge
                                variant={getStatusVariant(result.status)}
                                className={cn(
                                  'h-5 rounded-md px-1.5 py-0 text-[10px] font-medium border-0',
                                  getStatusBadgeClass(result.status)
                                )}
                              >
                                {result.status}
                              </Badge>
                            )}
                            {result.tags && result.tags.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground/90">
                                <Tag className="h-3 w-3 text-muted-foreground/70" />
                                <span className="truncate max-w-[120px]">
                                  {highlightSearchMatch(result.tags.slice(0, 2).join(', '), searchQuery)}
                                  {result.tags.length > 2 && ` +${result.tags.length - 2}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Keyboard hint */}
                        {index === selectedIndex && (
                          <div className="flex-shrink-0 text-xs text-muted-foreground">
                            <kbd className="rounded-md bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-zinc-800/90 dark:text-zinc-300">↵</kbd>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center rounded-md bg-muted/30 dark:bg-zinc-900/50 my-2 mx-2">
                    <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Try searching for tasks, habits, goals, or notes
                    </p>
                  </div>
                )}
                
                {/* Footer hint */}
                {searchResults.length > 0 && (
                  <div className="px-3.5 py-2 bg-slate-50/80 shadow-[inset_0_1px_0_rgba(148,163,184,0.2)] dark:bg-zinc-900/70 dark:shadow-[inset_0_1px_0_rgba(63,63,70,0.45)]">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <kbd className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/70">↑↓</kbd>
                        <span>Navigate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/70">↵</kbd>
                        <span>Select</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700/70">Esc</kbd>
                        <span>Close</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleTheme}
                  className={actionButtonClass}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle theme</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Filter Button */}
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn(actionButtonClass, 'relative')}>
                      <Filter className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filters</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-64 border-slate-200 bg-white text-slate-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 p-2">
              <DropdownMenuLabel className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Open Filters</DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-zinc-700" />
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100 dark:focus:bg-zinc-800 dark:focus:text-zinc-50" onClick={() => navigate('/tasks')}>Tasks</DropdownMenuItem>
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100 dark:focus:bg-zinc-800 dark:focus:text-zinc-50" onClick={() => navigate('/habits')}>Habits</DropdownMenuItem>
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100 dark:focus:bg-zinc-800 dark:focus:text-zinc-50" onClick={() => navigate('/goals')}>Goals</DropdownMenuItem>
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100 dark:focus:bg-zinc-800 dark:focus:text-zinc-50" onClick={() => navigate('/notes')}>Notes</DropdownMenuItem>
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100 dark:focus:bg-zinc-800 dark:focus:text-zinc-50" onClick={() => navigate('/analytics')}>Analytics</DropdownMenuItem>
              <DropdownMenuSeparator className="dark:bg-zinc-700" />
              <DropdownMenuItem onClick={() => {
                setSearchOpen(true)
                searchInputRef.current?.focus()
              }} className="rounded-xl bg-gradient-to-br from-green-50/50 to-emerald-50/40 px-3 py-3 shadow-none transition-all duration-200 hover:from-green-100/40 hover:to-emerald-50/60 hover:shadow-md focus:from-green-100/50 focus:to-emerald-100/40 dark:from-green-950/30 dark:to-emerald-950/20 dark:hover:from-green-900/40 dark:hover:to-emerald-900/30 dark:focus:from-green-900/50 dark:focus:to-emerald-900/40">
                <div className="flex w-full items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-green-500/15 p-1.5 text-green-600 dark:bg-green-500/25 dark:text-green-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Focus Search</span>
                      <kbd className="inline-flex h-5 items-center rounded bg-green-500/12 px-1.5 text-[10px] font-medium text-green-700 dark:bg-green-500/20 dark:text-green-300">⌘K</kbd>
                    </div>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-600 dark:text-zinc-300">Quickly find tasks, habits, goals, and notes with smart match highlighting.</span>
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <DropdownMenu onOpenChange={(open) => {
            if (open && unreadStoreNotifications > 0) {
              markAllAsRead()
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={cn(actionButtonClass, 'relative')}>
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-0 right-0 text-[11px] font-bold leading-none text-black dark:text-white">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[22rem] border-slate-200 bg-white text-slate-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 p-2 max-h-[32rem] overflow-y-auto">
              <DropdownMenuLabel className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-zinc-700" />
              {dropdownNotifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'rounded-lg px-3 py-3 focus:bg-slate-100 dark:focus:bg-zinc-800',
                    notification.priority === 'critical' && 'bg-red-50/80 dark:bg-red-950/30'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {renderNotificationIcon(notification)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-5 dark:text-zinc-50">{notification.title}</p>
                        {renderPriorityBadge(notification.priority)}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400">{notification.message}</p>
                      <span className="text-xs text-slate-500 dark:text-zinc-500">
                        {notification.time}
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              {dropdownNotifications.length === 0 && (
                <div className="py-6 px-3 text-center text-sm text-slate-600 dark:text-zinc-400">No active alerts</div>
              )}
              {notifications.length > 5 && (
                <>
                  <DropdownMenuSeparator className="dark:bg-zinc-700" />
                  <DropdownMenuItem className="rounded-md text-center text-sm font-medium text-primary focus:bg-slate-100 dark:focus:bg-zinc-800 dark:focus:text-primary" onClick={() => navigate('/settings?tab=notifications')}>
                    View all notifications
                  </DropdownMenuItem>
                </>
              )}
              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator className="dark:bg-zinc-700" />
                  <DropdownMenuItem onClick={clearNotifications} className="rounded-md text-destructive focus:bg-slate-100 focus:text-destructive dark:focus:bg-zinc-800 dark:focus:text-destructive">
                    Clear notifications
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={actionButtonClass} onClick={() => navigate('/help-support')}>
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help & Support</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 rounded-full p-0 overflow-hidden">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={userProfile.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-green-400 text-white text-sm font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-200 dark:bg-white dark:text-slate-900 p-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={userProfile.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-green-400 text-white font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{userProfile.name || 'User'}</p>
                    <p className="text-xs text-slate-600">{userProfile.email || 'Set up your profile'}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Today Progress</span>
                  <span className={cn(
                    "font-medium",
                    todayProductivity.overall >= 80 ? "text-green-500" :
                    todayProductivity.overall >= 50 ? "text-yellow-500" :
                    "text-green-500"
                  )}>
                    {todayProductivity.overall}%
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100" onClick={() => navigate('/settings')}>
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100" onClick={() => navigate('/settings')}>
                Preferences
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100" onClick={() => navigate('/backup')}>
                Backup & Restore
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-md px-3 py-2 text-sm font-medium focus:bg-slate-100" onClick={() => navigate('/help-support')}>
                Help & Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-md px-3 py-2 text-slate-500 cursor-not-allowed">
                Sign out (Local Mode)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-6 py-1.5 bg-secondary/70 dark:bg-zinc-800/95">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                syncStatus === 'syncing' ? "bg-yellow-500" :
                syncStatus === 'error' ? "bg-red-500" :
                "bg-green-500"
              )} />
              <span className="text-muted-foreground">
                {syncStatus === 'syncing' ? 'Syncing...' :
                 syncStatus === 'error' ? 'Sync Error' :
                 'System: Online'}
              </span>
            </div>
            <span className="text-muted-foreground">•</span>
            <Badge variant="secondary" className="font-normal dark:bg-zinc-800 dark:text-zinc-100">
              {syncEnabled ? 'Cloud Sync' : 'Local Mode'}
            </Badge>
            <span className="text-muted-foreground">•</span>
            <span className={cn(
              "font-medium text-green-500"
            )}>
              Progress: {todayProductivity.overall}%
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
