import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { shallow } from 'zustand/shallow'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { 
  Plus, 
  Eye,
  EyeOff,
  CheckSquare,
  Calendar,
  Clock,
  Edit,
  X,
  Target,
  TrendingUp,
  Pause,
  Play,
  List,
  Grid3X3,
  Archive,
} from 'lucide-react'
import { format, isToday, startOfDay, subDays } from 'date-fns'
import { safeParseDate } from '@/lib/date-safe'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateTaskDTO, UpdateTaskDTO, TaskTabStatsSnapshot } from '@/lib/database'
import { Task, TaskProgress, DailyTaskState, TaskStatus } from '@/types'
import { invalidateTaskRelatedQueries, buildTaskProgressUpdatePayload } from '@/lib/task-sync'
import { 
  AnimatedProgressBar,
  getProgressTextColor,
  type ProgressValue 
} from '@/components/ui/progress-selector'

import { TaskDurationType } from '@/types'
import { getTodaysTasks, getYesterdaysTasks, getDailyProgress, normalizeDailyProgress, recordDailyProgress } from '@/lib/daily-reset'
import { ContextTipsDialog } from '@/components/context-tips-dialog'
import { CheckboxView } from '@/components/tasks/matrix-view'
import { TaskAnalytics } from '@/components/tasks/task-analytics'
import { TaskItem } from '@/components/tasks/task-item'

interface TaskFormData {
  title: string
  description: string
  due_date: string
  priority: Task['priority']
  status: Task['status']
  estimated_time: string
  goal_id: string
  tags: string[]
  duration_type: TaskDurationType
}





const TASK_TIPS_SECTIONS = [
  {
    title: 'Avoid Multitasking & Burnout',
    points: [
      'Multitasking reduces focus and increases mistakes—concentrating on one task is more efficient.',
      'Doing anything at 50% quality is better than spreading yourself thin across three tasks at 100% effort.',
      'Prevention is key: protect your energy by saying no to non-essential work and setting realistic limits.',
      'Risk of burnout rises when you juggle too many tasks—prioritize deeply meaningful work over quantity.',
      'Single-tasking builds momentum and momentum builds confidence—both essential for sustainable productivity.',
    ],
  },
  {
    title: 'Prioritization That Works',
    points: [
      'Use high priority only for truly time-critical items; keep most work in medium to reduce overload.',
      'Treat multi-day tasks as continuity work and today-only tasks as same-day commitments.',
      'Link tasks to goals when possible so effort contributes to measurable long-term progress.',
    ],
  },
  {
    title: 'Progress Tracking Meaning',
    points: [
      '0% means skipped for that day and does not count as completion.',
      '25/50/75% represent partial movement and preserve realistic daily history.',
      '100% is the only fully completed state and drives completion metrics directly.',
    ],
  },
  {
    title: 'Overdue Handling',
    points: [
      'Update missed work in Yesterday first so analytics reflect what happened when it happened.',
      'For continuous tasks, resume progress today after recording the previous day status correctly.',
      'Avoid backfilling older dates to keep daily trends trustworthy and actionable.',
    ],
  },
  {
    title: 'Productivity Best Practices',
    points: [
      'Start with 1-3 meaningful tasks and finish them before expanding scope.',
      'Review skipped items at end of day and either reschedule or archive intentionally.',
      'Use weighted progress to balance quantity of tasks with actual impact.',
    ],
  },
] as const

const YESTERDAY_TIPS_SECTIONS = [
  {
    title: 'Purpose of Yesterday Section',
    points: [
      'This section is ONLY for marking tasks that were completed but forgotten to mark yesterday.',
      'Use it to record the accurate completion status for tasks you actually finished.',
      'It is NOT for doing yesterday\'s missed tasks - focus on today\'s work instead.',
    ],
  },
  {
    title: 'How to Update Correctly',
    points: [
      'Mark tasks as complete (100%) if you finished them yesterday but forgot to update.',
      'Update progress to reflect what you actually accomplished yesterday, not new work.',
      'After correcting yesterday, continue your focus on today\'s tasks to maintain momentum.',
    ],
  },
] as const




export default function Tasks() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToaster()
  const { tasks, goals, addTask, updateTask, archiveTask, deleteTask } = useStore(
    (state) => ({
      tasks: state.tasks,
      goals: state.goals,
      addTask: state.addTask,
      updateTask: state.updateTask,
      archiveTask: state.archiveTask,
      deleteTask: state.deleteTask,
    }),
    shallow,
  )
  
  const [viewMode, setViewMode] = useState<'list' | 'checkbox'>('list')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [taskDetailModal, setTaskDetailModal] = useState<Task | null>(null)
  const [taskToArchive, setTaskToArchive] = useState<Task | null>(null)
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    priority: 'medium',
    status: 'pending',
    estimated_time: '',
    goal_id: '',
    tags: [],
    duration_type: 'today', // Default to today-only
  })
  
  const [newTag, setNewTag] = useState('')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [dayKey, setDayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [showYesterdayTasks, setShowYesterdayTasks] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const nextDayKey = format(new Date(), 'yyyy-MM-dd')
      setDayKey((prev) => (prev === nextDayKey ? prev : nextDayKey))
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const parentRef = useRef<HTMLElement | null>(null)
  
  useEffect(() => {
    parentRef.current = document.querySelector('main')
  }, [])
  


  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    // In list view mode, only show today's and yesterday's tasks using daily reset logic
    if (viewMode === 'list') {
      const todaysTasks = getTodaysTasks(tasks)
      const pausedTasks = tasks.filter((task) => !task.deleted_at && task.is_paused)
      const todaysPinned = Array.from(new Map([...todaysTasks, ...pausedTasks].map((task) => [task.id, task])).values())
      const yesterdaysTasks = getYesterdaysTasks(tasks)
      return [...todaysPinned, ...yesterdaysTasks].sort((a, b) => {
        // Sort by due date if available, otherwise by created date
        const aDate = a.due_date ? safeParseDate(a.due_date) : safeParseDate(a.created_at)
        const bDate = b.due_date ? safeParseDate(b.due_date) : safeParseDate(b.created_at)
        return aDate.getTime() - bDate.getTime()
      })
    }
    
    // In calendar/checkbox view, show non-deleted tasks
    // - Continuous tasks always visible
    // - Today-only tasks only visible on their creation day
    const todayDay = startOfDay(new Date())
    return tasks
      .filter(task => !task.deleted_at)
      .filter(task => {
        if (task.is_paused) return true

        if (task.duration_type === 'today') {
          const taskCreatedAt = startOfDay(safeParseDate(task.created_at))
          return taskCreatedAt.getTime() === todayDay.getTime()
        }
        return true
      })
      .sort((a, b) => {
        // Sort: continuous tasks first, then by creation date
        if (a.duration_type === 'continuous' && b.duration_type !== 'continuous') return -1
        if (a.duration_type !== 'continuous' && b.duration_type === 'continuous') return 1
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
  }, [tasks, viewMode, dayKey])

  // Group tasks by date - STRICTLY only Today's Tasks and Yesterday's Tasks for list mode
  // ⚠️ DATA INTEGRITY: This is visual grouping only
  // Removing tasks from "Yesterday's Tasks" display at midnight does NOT delete them
  // Tasks remain in database and are still counted in all statistics
  // Per final specification: Only two sections allowed (TODAY and YESTERDAY)
  // Uses centralized daily-reset logic as SINGLE SOURCE OF TRUTH for date-based filtering
  const tasksByDate = useMemo(() => {
    if (viewMode !== 'list') return {}
    
    // Use helper functions as single source of truth
    // This ensures consistent behavior across the app
    const todaysTasks = getTodaysTasks(tasks)
    const pausedTasks = tasks.filter((task) => !task.deleted_at && task.is_paused)
    const todaysPinned = Array.from(new Map([...todaysTasks, ...pausedTasks].map((task) => [task.id, task])).values())
    const yesterdaysTasks = getYesterdaysTasks(tasks)
    
    const groups: Record<string, Task[]> = {}
    
    if (todaysPinned.length > 0) {
      groups["Today's Tasks"] = todaysPinned.sort((a, b) => {
        // Sort by due date if available, otherwise by created date
        const aDate = a.due_date ? safeParseDate(a.due_date) : safeParseDate(a.created_at)
        const bDate = b.due_date ? safeParseDate(b.due_date) : safeParseDate(b.created_at)
        return aDate.getTime() - bDate.getTime()
      })
    }
    
    if (yesterdaysTasks.length > 0) {
      groups["Yesterday's Tasks"] = yesterdaysTasks.sort((a, b) => {
        // Sort by due date if available, otherwise by created date
        const aDate = a.due_date ? safeParseDate(a.due_date) : safeParseDate(a.created_at)
        const bDate = b.due_date ? safeParseDate(b.due_date) : safeParseDate(b.created_at)
        return aDate.getTime() - bDate.getTime()
      })
    }
    
    return groups
  }, [tasks, viewMode, dayKey])

  const flatItems = useMemo(() => {
    const items: any[] = []
    
    if (viewMode !== 'list' || filteredTasks?.length === 0) return items
    
    const sortedGroups = Object.entries(tasksByDate || {}).sort((a, b) => {
      if (a[0] === b[0]) return 0
      return a[0] === "Today's Tasks" ? -1 : 1
    })

    for (const [group, groupTasks] of sortedGroups) {
      items.push({ type: 'header', group, count: (groupTasks as Task[]).length })
      
      const isYesterdaySection = group === "Yesterday's Tasks"
      if (isYesterdaySection && !showYesterdayTasks) {
        continue
      }
      
      const displayDateStr = isYesterdaySection ? format(subDays(new Date(), 1), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
      const displayDate = isYesterdaySection ? subDays(new Date(), 1) : new Date()

      for (const task of groupTasks as Task[]) {
        let displayTask = task
        if (isYesterdaySection) {
          const history = normalizeDailyProgress(task)
          const yesterdayEntry = history[displayDateStr]
          displayTask = {
            ...task,
            progress: getDailyProgress(task, displayDate) as ProgressValue,
            status: yesterdayEntry?.status ?? task.status,
            is_paused: yesterdayEntry?.source === 'paused',
          }
        }
        items.push({ 
          type: 'task', 
          task: displayTask, 
          group, 
          displayDateStr,
          isYesterdaySection
        })
      }
    }
    
    return items
  }, [filteredTasks, tasksByDate, showYesterdayTasks])

  const listVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index]
      if (item.type === 'header') return 60
      return 120 // Estimated height of TaskItem
    },
    overscan: 5,
  })

  const { data: statsSnapshot } = useQuery<TaskTabStatsSnapshot>({
    queryKey: ['task-stats', dayKey],
    queryFn: () => database.getTaskTabStats(),
    staleTime: 30 * 1000,
  })

  // Calculate statistics strictly from database snapshot
  const stats = useMemo(() => {
    const emptyPeriod = {
      total: 0,
      completed: 0,
      partially: 0,
      skipped: 0,
      plannedWeight: 0,
      earnedWeight: 0,
      weightedProgress: 0,
    }

    if (!statsSnapshot) {
      return {
        dailyProgress: 0,
        totalToday: 0,
        completedToday: 0,
        totalWeightToday: 0,
        currentWeightToday: 0,
        total: 0,
        completed: 0,
        partially: 0,
        skipped: 0,
        incomplete: 0,
        completionRate: 0,
        weightedProgress: 0,
        totalWeight: 0,
        completedWeight: 0,
        weeklyStats: emptyPeriod,
        weekDelta: 0,
        monthlyStats: emptyPeriod,
        monthDelta: 0,
      }
    }

    const weekDelta = statsSnapshot.weekly.weightedProgress - statsSnapshot.previousWeekly.weightedProgress
    const monthDelta = statsSnapshot.monthly.weightedProgress - statsSnapshot.previousMonthly.weightedProgress
    const total = statsSnapshot.health.total
    const completed = statsSnapshot.health.completed

    return {
      dailyProgress: statsSnapshot.today.weightedProgress,
      totalToday: statsSnapshot.today.total,
      completedToday: statsSnapshot.today.completed,
      totalWeightToday: statsSnapshot.today.plannedWeight,
      currentWeightToday: statsSnapshot.today.earnedWeight,
      total,
      completed,
      partially: statsSnapshot.health.partially,
      skipped: statsSnapshot.health.skipped,
      incomplete: Math.max(total - completed, 0),
      completionRate: statsSnapshot.health.weightedProgress,
      weightedProgress: statsSnapshot.health.weightedProgress,
      totalWeight: statsSnapshot.health.plannedWeight,
      completedWeight: statsSnapshot.health.earnedWeight,
      weeklyStats: statsSnapshot.weekly,
      weekDelta,
      monthlyStats: statsSnapshot.monthly,
      monthDelta,
    }
  }, [statsSnapshot])

  const invalidateTaskDerivedQueries = useCallback(() => {
    invalidateTaskRelatedQueries(queryClient)
  }, [queryClient])

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskDTO) => {
      const newTaskId = await database.createTask(taskData)
      const newTask = await database.getTaskById(newTaskId)
      return newTask
    },
    onSuccess: (newTask) => {
      if (newTask) {
        addTask(newTask as any)
        success('Task created successfully! 🎉')
        setIsCreating(false)
        resetForm()
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to create task'),
  })

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const existingTask = tasks.find(t => t.id === id)
      if (existingTask) {
        updateTask({ ...existingTask, ...updates } as any)
      }
      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return updatedTask
    },
    onSuccess: (updatedTask) => {
      if (updatedTask) {
        updateTask(updatedTask as any)
        success('Task updated!')
        setIsCreating(false)
        setIsEditing(null)
        resetForm()
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to update task'),
  })

  // Pause/Resume mutation for continuous tasks
  const pauseToggleMutation = useMutation({
    mutationFn: async ({ id, isPaused }: { id: string; isPaused: boolean }) => {
      const existingTask = tasks.find(task => task.id === id)
      const updates: UpdateTaskDTO = {
        is_paused: isPaused,
      }
      if (existingTask) {
        const now = new Date()
        const nowIso = now.toISOString()
        const todayKey = format(new Date(), 'yyyy-MM-dd')
        const dailyProgress = normalizeDailyProgress(existingTask)
        const currentEntry = dailyProgress[todayKey]

        if (isPaused) {
          dailyProgress[todayKey] = {
            progress: (currentEntry?.progress ?? existingTask.progress ?? 0) as TaskProgress,
            status: (currentEntry?.status ?? existingTask.status ?? 'pending') as TaskStatus,
            recorded_at: nowIso,
            source: 'paused',
          }

          updates.daily_progress = dailyProgress
        } else {
          // Backfill every paused calendar day so skipped frozen days never count in analytics.
          const pausedAt = existingTask.paused_at ? safeParseDate(existingTask.paused_at) : null
          if (pausedAt) {
            const frozenDayKey = format(startOfDay(pausedAt), 'yyyy-MM-dd')
            const frozenEntry = dailyProgress[frozenDayKey]
            const frozenProgress = (frozenEntry?.progress ?? existingTask.progress ?? 0) as TaskProgress
            const frozenStatus = (frozenEntry?.status ?? existingTask.status ?? 'pending') as TaskStatus

            const cursor = startOfDay(pausedAt)
            const yesterday = startOfDay(now)
            yesterday.setDate(yesterday.getDate() - 1)

            let wroteBackfill = false
            while (cursor.getTime() <= yesterday.getTime()) {
              const dayKey = format(cursor, 'yyyy-MM-dd')
              const existingEntry = dailyProgress[dayKey]

              if (!existingEntry || existingEntry.source !== 'paused') {
                dailyProgress[dayKey] = {
                  progress: frozenProgress,
                  status: frozenStatus,
                  recorded_at: nowIso,
                  source: 'paused',
                }
                wroteBackfill = true
              }

              cursor.setDate(cursor.getDate() + 1)
            }

            if (wroteBackfill) {
              updates.daily_progress = dailyProgress
            }
          }
        }
      }
      if (isPaused) {
        updates.paused_at = new Date().toISOString()
      } else {
        updates.paused_at = undefined
      }

      if (existingTask) {
        updateTask({ ...existingTask, ...updates } as any)
      }

      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return { updatedTask, isPaused }
    },
    onSuccess: ({ updatedTask, isPaused }) => {
      if (updatedTask) {
        updateTask(updatedTask as any)
        if (isPaused) {
          success('Task paused ⏸️ Progress frozen')
        } else {
          success('Task resumed ▶️')
        }
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to toggle pause state'),
  })

  // NOTE: The conflicting per-page reset effect has been removed.
  // All daily reset logic is handled centrally by the useDailyReset() hook in App.tsx.
  // That hook snapshots daily_progress and resets continuous tasks at midnight.
  // Today-only tasks don't need resetting — they simply age out of getTodaysTasks().

  const updateProgressMutation = useMutation({
    onMutate: async ({ id, progress }) => {
      const existingTask = tasks.find((t: any) => t.id === id)
      if (existingTask) {
        updateTask({ ...existingTask, progress } as any)
      }
      return { previousTask: existingTask }
    },
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const existingTask = tasks.find(t => t.id === id)
      if (!existingTask) throw new Error('Task not found')

      const { updates } = buildTaskProgressUpdatePayload(existingTask as Task, progress)
      
      // Background persistence
      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return { updatedTask, progress }
    },
    onSuccess: ({ updatedTask, progress }) => {
      if (updatedTask) {
        updateTask(updatedTask as any)
        if (progress === 100) {
          success('Task completed! 🎉🎊')
        } else if (progress === 0) {
          success('Task skipped.')
        }
        queryClient.invalidateQueries({ queryKey: ['review-insights'] })
        invalidateTaskDerivedQueries()
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTask) {
        updateTask(context.previousTask as any)
      }
      toastError('Failed to update progress')
    },
  })

  const updateDailyProgressMutation = useMutation({
    mutationFn: async ({ id, dailyProgress }: { id: string; dailyProgress: Record<string, DailyTaskState> }) => {
      const existingTask = tasks.find(t => t.id === id)
      if (existingTask) {
        updateTask({ ...existingTask, daily_progress: dailyProgress } as any)
      }
      
      await database.updateTask(id, { daily_progress: dailyProgress })
      const updatedTask = await database.getTaskById(id)
      return updatedTask
    },
    onSuccess: (updatedTask) => {
      if (updatedTask) {
        updateTask(updatedTask as any)
        queryClient.invalidateQueries({ queryKey: ['review-insights'] })
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to update daily progress'),
  })

  const deleteTaskMutation = useMutation({
    onMutate: async (id: string) => {
      const previousTask = tasks.find((t: any) => t.id === id)
      if (previousTask) {
        archiveTask(id)
      }
      return { previousTask }
    },
    mutationFn: async (id: string) => {
      // Archive task instead of permanent delete - preserves progress history
      await database.archiveTask(id)
      return id
    },
    onSuccess: () => {
      // Invalidate archive queries so it shows up in archive
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      invalidateTaskDerivedQueries()
      success('Task archived. Progress history preserved.')
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTask) {
        updateTask(context.previousTask as any)
      }
      toastError('Failed to archive task')
    },
  })

  // Permanent delete mutation - completely removes task and all its data
  const permanentDeleteTaskMutation = useMutation({
    onMutate: async (id: string) => {
      const previousTask = tasks.find((t: any) => t.id === id)
      if (previousTask) {
        deleteTask(id)
      }
      return { previousTask }
    },
    mutationFn: async (id: string) => {
      // Completely remove task and all associated data (checklist items, time blocks, notes, etc.)
      await database.permanentlyDeleteTask(id, { deleteHistory: true })
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      invalidateTaskDerivedQueries()
      success('Task permanently deleted. All data removed.')
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTask) {
        updateTask(context.previousTask as any)
      }
      toastError('Failed to permanently delete task')
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      priority: 'medium',
      status: 'pending',
      estimated_time: '',
      goal_id: '',
      tags: [],
      duration_type: 'today',
    })
    setNewTag('')
  }

  useEffect(() => {
    const openCreateTask = () => {
      setIsEditing(null)
      resetForm()
      setIsCreating(true)
    }

    window.addEventListener('app:new-task', openCreateTask as EventListener)
    return () => window.removeEventListener('app:new-task', openCreateTask as EventListener)
  }, [])

  const handleEdit = (task: Task) => {
    setIsEditing(task.id)
    setIsCreating(true)
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? format(safeParseDate(task.due_date), 'yyyy-MM-dd') : '',
      priority: task.priority,
      status: task.status,
      estimated_time: task.estimated_time?.toString() || '',
      goal_id: task.goal_id || '',
      tags: task.tags || [],
      duration_type: task.duration_type || 'today',
    })
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toastError('Please enter a task title')
      return
    }

    const taskData: any = {
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      status: 'pending', // Always start as pending - progress is set via progress selector
      progress: isEditing ? undefined : 0,
      duration_type: formData.duration_type,
      tags: formData.tags,
      estimated_time: formData.estimated_time ? parseInt(formData.estimated_time, 10) : undefined,
      goal_id: formData.goal_id || undefined,
      due_date: formData.due_date || undefined,
      is_paused: false, // Initialize as not paused for continuous tasks
    }

    if (isEditing) {
      updateTaskMutation.mutate({ id: isEditing, updates: taskData })
    } else {
      createTaskMutation.mutate(taskData)
    }
  }

  const handleMatrixProgressChange = useCallback((taskId: string, date: string, progress: ProgressValue) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    if (task.is_paused) return

    const taskCreatedDay = startOfDay(safeParseDate(task.created_at))
    const targetDay = startOfDay(safeParseDate(date))
    if (targetDay.getTime() < taskCreatedDay.getTime()) return

    // Derive proper status from progress value
    const status = progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'skipped'
    // For today's date, update once via updateProgressMutation.
    // It already persists today's daily_progress snapshot in the same DB write.
    if (isToday(safeParseDate(date))) {
      updateProgressMutation.mutate({ id: taskId, progress })
      return
    }

    // Historical day updates only need daily_progress persistence.
    const dailyProgress = recordDailyProgress(task, safeParseDate(date), progress as any, status, 'user')
    updateDailyProgressMutation.mutate({ id: taskId, dailyProgress })
  }, [tasks, updateDailyProgressMutation, updateProgressMutation])

  const toggleTaskExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedTasks(newExpanded)
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) })
  }
  
  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-3xl font-bold">Tasks</h1>
            <ContextTipsDialog
              title="Task Tab Tips"
              description="Practical guidance for prioritization, progress tracking, overdue handling, and daily execution."
              sections={TASK_TIPS_SECTIONS}
              triggerLabel="Open task tips"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Track your progress with clarity and motivation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border bg-secondary/30 p-0.5">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">List</span>
            </Button>
            <Button
              variant={viewMode === 'checkbox' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('checkbox')}
            >
              <Grid3X3 className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Checkbox</span>
            </Button>
          </div>
          
          <Dialog open={isCreating} onOpenChange={(open) => {
            setIsCreating(open)
            if (!open) {
              setIsEditing(null)
              resetForm()
            }
          }}>
            <DialogTrigger asChild>
              <Button
                className="transition-transform duration-150 hover:scale-[1.02] active:scale-95 shadow-sm gpu-accelerated"
                size="sm"
                onClick={() => {
                  setIsEditing(null)
                  resetForm()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogDescription>
                  Define your task with a clear title, description, and deadline.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-2 -mr-2 scroll-smooth">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Task Title
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <Input
                      placeholder="What needs to be done?"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      key={`task-description-${isEditing ?? 'new'}`}
                      placeholder="Add details, notes, or context..."
                      defaultValue={formData.description}
                      onBlur={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority (Weight)</label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value: Task['priority']) => setFormData({ ...formData, priority: value })}
                      >
                        <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              High (Weight: 3)
                            </div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              Medium (Weight: 2)
                            </div>
                          </SelectItem>
                          <SelectItem value="low">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              Low (Weight: 1)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Duration Type *</label>
                      <Select
                        value={formData.duration_type}
                        onValueChange={(value: TaskDurationType) => {
                          // Clear due_date when switching to "today" type
                          if (value === 'today') {
                            setFormData({ ...formData, duration_type: value, due_date: '' })
                          } else {
                            setFormData({ ...formData, duration_type: value })
                          }
                        }}
                      >
                        <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today Only</SelectItem>
                          <SelectItem value="continuous">Multi-day / Continuous</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={cn("text-sm font-medium", formData.duration_type === 'today' && "text-muted-foreground")}>Due Date</label>
                      <Input
                        type="date"
                        disabled={formData.duration_type === 'today'}
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className={cn("bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15", formData.duration_type === 'today' && "opacity-50 cursor-not-allowed")}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estimated Time (minutes)</label>
                      <Input
                        type="number"
                        placeholder="e.g., 30"
                        value={formData.estimated_time}
                        onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                        className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Related Goal</label>
                    <Select
                      value={formData.goal_id || "none"}
                      onValueChange={(value: string) => setFormData({ ...formData, goal_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                        <SelectValue placeholder="Select a goal..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Goal</SelectItem>
                        {goals?.filter((g: any) => g.status === 'active').map((goal: any) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            {goal.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                      />
                      <Button type="button" onClick={addTag} variant="secondary">
                        Add
                      </Button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="gap-1 bg-purple-500/10 text-purple-700 border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <DialogFooter className="flex-shrink-0 border-t pt-4">
                <Button variant="outline" onClick={() => {
                  setIsCreating(false)
                  setIsEditing(null)
                  resetForm()
                }} className="bg-transparent dark:bg-transparent border-green-500/30 text-green-600 dark:text-green-300 hover:bg-green-500/10 hover:border-green-500/50 transition-colors duration-200">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                >
                  {isEditing ? 'Update Task' : 'Create Task'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Progress</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.dailyProgress))}>
              {stats.dailyProgress}%
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Total tasks</div>
              <div className="text-right">{stats.totalToday}</div>
              <div>Completed</div>
              <div className="text-right text-green-500">{stats.completedToday}</div>
              <div>Weight</div>
              <div className="text-right font-semibold">({Math.round(stats.currentWeightToday)}/{Math.round(stats.totalWeightToday)})</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.weeklyStats.weightedProgress))}>
              {stats.weeklyStats.weightedProgress}%
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total Tasks</span>
                <span className="font-semibold text-foreground">{stats.weeklyStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="font-semibold text-green-500">{stats.weeklyStats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Partially</span>
                <span className="font-semibold text-blue-500">{stats.weeklyStats.partially}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped</span>
                <span className="font-semibold text-red-500">{stats.weeklyStats.skipped}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Weight</span>
                <span className="font-semibold text-purple-500">
                  {Math.round(stats.weeklyStats.earnedWeight)}/{Math.round(stats.weeklyStats.plannedWeight)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Progress</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.monthlyStats.weightedProgress))}>
              {stats.monthlyStats.weightedProgress}%
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total Tasks</span>
                <span className="font-semibold text-foreground">{stats.monthlyStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="font-semibold text-green-500">{stats.monthlyStats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Partially</span>
                <span className="font-semibold text-blue-500">{stats.monthlyStats.partially}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped</span>
                <span className="font-semibold text-red-500">{stats.monthlyStats.skipped}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Weight</span>
                <span className="font-semibold text-purple-500">
                  {Math.round(stats.monthlyStats.earnedWeight)}/{Math.round(stats.monthlyStats.plannedWeight)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Health</CardTitle>
            <CheckSquare className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-purple-500">{stats.completionRate}%</div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total Tasks</span>
                <span className="font-semibold text-foreground">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="font-semibold text-green-500">{stats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Partially</span>
                <span className="font-semibold text-blue-500">{stats.partially}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped</span>
                <span className="font-semibold text-red-500">{stats.skipped}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Weight</span>
                <span className="font-semibold text-purple-500">
                  {Math.round(stats.completedWeight)}/{Math.round(stats.totalWeight)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Checkbox View */}
      {viewMode === 'checkbox' && (
        <CheckboxView
          tasks={filteredTasks}
          onProgressChange={handleMatrixProgressChange}
          onTaskClick={(task) => setTaskDetailModal(task)}
        />
      )}

      {/* Tasks List - Only show in list view */}
      {viewMode === 'list' && (
        <div className="space-y-6">
        {filteredTasks?.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first task to get started!
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div style={{ height: `${listVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
             {listVirtualizer.getVirtualItems().map(virtualRow => {
                const item = flatItems[virtualRow.index]
                
                return (
                   <div 
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={listVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                      className={item.type === 'task' ? "pb-3" : "pb-4 pt-2"}
                   >
                     {item.type === 'header' ? (
                        <div>
                          <h2 className="text-lg font-semibold flex items-center gap-2">
                            {item.group} 
                            <Badge variant="outline" className="text-xs">
                              {item.count}
                            </Badge>
                            {item.group === "Yesterday's Tasks" && (
                              <>
                                <ContextTipsDialog
                                  title="Yesterday Section Guidance"
                                  description="Use this section only for yesterday corrections so your timeline remains accurate."
                                  sections={YESTERDAY_TIPS_SECTIONS}
                                  triggerLabel="Open yesterday section guidance"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setShowYesterdayTasks(!showYesterdayTasks)}
                                  aria-label={showYesterdayTasks ? "Hide yesterday tasks" : "Show yesterday tasks"}
                                >
                                  {showYesterdayTasks ? (
                                    <Eye className="h-4 w-4" />
                                  ) : (
                                    <EyeOff className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </h2>
                        </div>
                     ) : (
                        <TaskItem
                          task={item.task}
                          goals={goals}
                          expanded={expandedTasks.has(item.task.id)}
                          onToggleExpand={() => toggleTaskExpanded(item.task.id)}
                          onProgressChange={(progress) => handleMatrixProgressChange(item.task.id, item.displayDateStr, progress)}
                          onEdit={() => handleEdit(item.task)}
                          onDelete={() => setTaskToArchive(item.task)}
                          onOpenDetails={() => setTaskDetailModal(item.task)}
                          onPauseToggle={(isPaused) => pauseToggleMutation.mutate({ id: item.task.id, isPaused })}
                          hideActions={item.isYesterdaySection}
                          allowProgressEditWhenPaused={false}
                        />
                     )}
                   </div>
                )
             })}
          </div>
        )}
        </div>
      )}

      {/* Analytics Section */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-300">
        <TaskAnalytics dayKey={dayKey} showDailyActivity={viewMode !== 'checkbox'} />
      </div>

      {/* Task Detail Modal */}
      <Dialog open={taskDetailModal !== null} onOpenChange={(open) => !open && setTaskDetailModal(null)}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Task Details
            </DialogTitle>
          </DialogHeader>
          
          {taskDetailModal && (
            <div className="space-y-4 py-2">
              {/* Title and Status */}
              <div className="space-y-2">
                <h3 className={cn(
                  "text-lg font-semibold",
                  taskDetailModal.is_paused && "line-through text-muted-foreground"
                )}>
                  {taskDetailModal.title}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Badge 
                    className={cn(
                      "font-semibold",
                      taskDetailModal.priority === 'high' && "bg-red-600 hover:bg-red-700",
                      taskDetailModal.priority === 'medium' && "bg-amber-600 hover:bg-amber-700",
                      taskDetailModal.priority === 'low' && "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    {taskDetailModal.priority.toUpperCase()} PRIORITY
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={cn(
                      taskDetailModal.duration_type === 'continuous' 
                        ? "bg-purple-50 text-purple-700 border-purple-200" 
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    )}
                  >
                    {taskDetailModal.duration_type === 'continuous' ? 'Multi-day' : 'Today-only'}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={cn(getProgressTextColor(taskDetailModal.progress || 0))}
                  >
                    {taskDetailModal.progress || 0}%
                  </Badge>
                  {taskDetailModal.is_paused && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      ⏸️ Paused
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Description */}
              {taskDetailModal.description && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm bg-secondary/30 p-3 rounded-lg max-h-40 overflow-y-auto scroll-smooth">
                    {taskDetailModal.description}
                  </p>
                </div>
              )}
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {taskDetailModal.due_date && taskDetailModal.duration_type !== 'continuous' && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Due Date
                    </label>
                    <p className="font-medium">{format(safeParseDate(taskDetailModal.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                
                {taskDetailModal.estimated_time && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Estimated Time
                    </label>
                    <p className="font-medium">{taskDetailModal.estimated_time} minutes</p>
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-muted-foreground">Created</label>
                  <p className="font-medium">{format(safeParseDate(taskDetailModal.created_at), 'MMM d, yyyy')}</p>
                </div>
                
                {taskDetailModal.goal_id && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Goal
                    </label>
                    <p className="font-medium">{goals.find(g => g.id === taskDetailModal.goal_id)?.title || 'Unknown'}</p>
                  </div>
                )}
              </div>
              
              {/* Tags */}
              {taskDetailModal.tags && taskDetailModal.tags.length > 0 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {taskDetailModal.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* All-Time Progress (Aggregated across daily_progress) */}
              {taskDetailModal.duration_type === 'continuous' && taskDetailModal.daily_progress && Object.keys(taskDetailModal.daily_progress).length > 0 && (
                <div className="space-y-2 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <label className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    All-Time Progress
                  </label>
                  {(() => {
                    const dailyProgress = Object.values(taskDetailModal.daily_progress || {}) as Array<DailyTaskState>
                    const activeDays = dailyProgress.filter((entry) => entry?.source !== 'paused')
                    const completedDays = activeDays.filter((entry) => (entry.progress ?? 0) >= 100 || entry.status === 'completed').length
                    const partialDays = activeDays.filter((entry) => {
                      const progress = entry.progress ?? 0
                      return progress > 0 && progress < 100 && entry.status !== 'completed'
                    }).length
                    const skippedDays = activeDays.filter((entry) => {
                      const progress = entry.progress ?? 0
                      const status = entry.status ?? 'pending'
                      return status === 'skipped' || (progress <= 0 && status !== 'completed')
                    }).length
                    const totalDays = activeDays.length

                    return (
                      <p className="text-sm text-foreground/90">
                        Total: <span className="font-semibold">{totalDays}</span>, Completed: <span className="font-semibold text-green-600 dark:text-green-400">{completedDays}</span>, Partial: <span className="font-semibold text-amber-600 dark:text-amber-400">{partialDays}</span>, Skipped: <span className="font-semibold text-rose-600 dark:text-rose-400">{skippedDays}</span>
                      </p>
                    )
                  })()}
                </div>
              )}
              
              {/* Current Progress Bar */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Current Progress</label>
                <AnimatedProgressBar value={taskDetailModal.progress || 0} height="md" />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            {/* START / PAUSE Button - Only for Continuous Tasks */}
            {/* Default State: START (when task is paused) | Active State: PAUSE (when task is active) */}
            {taskDetailModal?.duration_type === 'continuous' && (
              taskDetailModal.is_paused ? (
                /* START Button - Task is paused, click to resume */
                <Button 
                  variant="outline"
                  className="text-green-600 hover:bg-green-500/10 hover:text-green-700"
                  onClick={() => {
                    if (taskDetailModal) {
                      pauseToggleMutation.mutate({ id: taskDetailModal.id, isPaused: !taskDetailModal.is_paused })
                      setTaskDetailModal(null)
                    }
                  }}
                >
                  <Play className="mr-2 h-4 w-4" />
                  START
                </Button>
              ) : (
                /* PAUSE Button - Task is active, click to pause */
                <Button 
                  variant="outline"
                  className="text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                  onClick={() => {
                    if (taskDetailModal) {
                      pauseToggleMutation.mutate({ id: taskDetailModal.id, isPaused: !taskDetailModal.is_paused })
                      setTaskDetailModal(null)
                    }
                  }}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  PAUSE
                </Button>
              )
            )}
            <Button 
              variant="outline"
              className="text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
              onClick={() => {
                if (taskDetailModal) {
                  setTaskToArchive(taskDetailModal)
                }
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTaskDetailModal(null)}
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                if (taskDetailModal) {
                  handleEdit(taskDetailModal)
                  setTaskDetailModal(null)
                }
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Alert */}
      <AlertDialog open={!!taskToArchive} onOpenChange={(open: boolean) => !open && setTaskToArchive(null)}>
        <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {taskToArchive?.duration_type === 'today' ? 'Archive or Delete Task?' : 'Archive Task'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {taskToArchive?.duration_type === 'today' 
                  ? `Choose how to handle "${taskToArchive?.title}":`
                  : `Are you sure you want to archive "${taskToArchive?.title}"?`
                }
              </p>
              {taskToArchive?.duration_type === 'today' && (
                <div className="space-y-2 text-sm">
                  <div className="p-3 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30">
                    <p className="font-medium text-orange-900 dark:text-orange-200 mb-1">📦 Archive</p>
                    <p className="text-orange-700 dark:text-orange-300">Move to Archive tab. Can be restored later. Progress history preserved.</p>
                  </div>
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                    <p className="font-medium text-red-900 dark:text-red-200 mb-1">🗑️ Permanent Delete</p>
                    <p className="text-red-700 dark:text-red-300">Completely remove all data including completion status, counts, weighted progress, dashboard contributions, analytics, and related statistics. <strong>This action cannot be undone.</strong></p>
                  </div>
                </div>
              )}
              {taskToArchive?.duration_type !== 'today' && (
                <p>This will move it to the Archive tab. You can restore it later.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={taskToArchive?.duration_type === 'today' ? 'flex-col sm:flex-row gap-2' : ''}>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToArchive) {
                  deleteTaskMutation.mutate(taskToArchive.id)
                  if (taskDetailModal?.id === taskToArchive.id) {
                    setTaskDetailModal(null)
                  }
                  setTaskToArchive(null)
                }
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Archive
            </AlertDialogAction>
            {taskToArchive?.duration_type === 'today' && (
              <AlertDialogAction
                onClick={() => {
                  if (taskToArchive) {
                    permanentDeleteTaskMutation.mutate(taskToArchive.id)
                    if (taskDetailModal?.id === taskToArchive.id) {
                      setTaskDetailModal(null)
                    }
                    setTaskToArchive(null)
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Permanent Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

