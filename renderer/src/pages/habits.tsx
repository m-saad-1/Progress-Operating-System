import { useEffect, useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Plus,
  Calendar,
  Flame,
  TrendingUp,
  Target,
  Edit,
  CheckCircle,
  X,
  Archive,
  AlertCircle
} from 'lucide-react'
import { format, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, isAfter, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { safeParseDate } from '@/lib/date-safe'
import { useToaster } from '@/hooks/use-toaster'
import { useElectron } from '@/hooks/use-electron'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateHabitDTO, UpdateHabitDTO, getLocalDateString } from '@/lib/database'
import { 
  calculateHabitAnalytics, 
  calculateHabitDueMetricsForDay,
  calculateHabitDueSeries,
  getDateRange, 
  calculateCurrentHabitStreak,
  calculateLongestHabitStreak,
  calculateCheckInsStats
} from '@/lib/progress'
import { Habit, HabitCompletion } from '@/types'
import { validateHabitForm } from '@/lib/habit-logic'
import { calculateHabitStreaks, countHabitCompletedPeriods, countHabitTotalPeriods } from '@/lib/habit-streaks'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

interface HabitFormData {
  title: string
  description: string
  frequency: Habit['frequency'] | '' // Allow empty string for "not selected" state
  schedule: string[]
  goal_id: string
  tags: string[]
}

interface HabitStats {
  // Structure: Static habit counts
  total: number
  daily: number
  weekly: number
  monthly: number
  
  // Today: Daily feedback
  todayCompletedCount: number
  todayExpectedCount: number
  todayCompletionPercentage: number
  
  // Momentum: Current & Longest Streaks
  currentStreak: number
  longestStreak: number
  activeStreaks: number
  
  // Reliability: Long-term consistency
  averageConsistency: number
  
  // Volume: 30-day completions
  checkInsCompleted: number
  checkInsTotal: number
}

const HABIT_TIPS_SECTIONS = [
  {
    title: 'Habit Purpose and Consistency',
    points: [
      'Habits turn repeated actions into stable systems, reducing reliance on motivation swings.',
      'Consistency score reflects reliability over time, not one-time intensity.',
      'Aim for steady completions instead of all-or-nothing streak pressure.',
    ],
  },
  {
    title: 'Streak Logic',
    points: [
      'Streaks follow frequency rules: daily checks daily, weekly checks within the current week, monthly within the current month.',
      'Missing expected periods lowers momentum and consistency metrics.',
      'Recover quickly after misses; long streaks are built by fast restarts.',
    ],
  },
  {
    title: 'Best Practices by Frequency',
    points: [
      'Daily: keep actions small and clear so completion is realistic every day.',
      'Weekly: assign a fixed weekday anchor to avoid last-minute catch-up.',
      'Monthly: schedule checkpoint dates early in the month to prevent end-of-month overload.',
    ],
  },
] as const

export default function Habits() {
  const electron = useElectron()
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToaster()
  const { habits, goals, addHabit, updateHabit, archiveHabit } = useStore()

  const [searchQuery] = useState('')
  const [selectedFrequency] = useState<Habit['frequency'] | 'all'>('all')
  const [selectedGoal] = useState<string | 'all'>('all')
  const [sortBy] = useState<'streak' | 'consistency' | 'created' | 'updated'>('streak')
  const [activeTab, setActiveTab] = useState('all')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<HabitFormData>({
    title: '',
    description: '',
    frequency: '', // Empty by default - user must select
    schedule: [],
    goal_id: '',
    tags: [],
  })
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})  
  const [newTag, setNewTag] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [habitPendingUndoneConfirm, setHabitPendingUndoneConfirm] = useState<Habit | null>(null)

  useEffect(() => {
    const openCreateHabit = () => {
      setIsEditing(null)
      setFormData({
        title: '',
        description: '',
        frequency: '',
        schedule: [],
        goal_id: '',
        tags: [],
      })
      setNewTag('')
      setIsCreating(true)
    }

    window.addEventListener('app:new-habit', openCreateHabit as EventListener)
    return () => window.removeEventListener('app:new-habit', openCreateHabit as EventListener)
  }, [])

  // Use LOCAL date string consistently - critical for correct habit tracking
  // MUST be declared before getHabitCompletionForDay function that uses it
  const todayStr = getLocalDateString(new Date())

  // Fetch completions for TODAY specifically (for instant button state updates)
  // MUST be before getHabitCompletionForDay function
  const { data: todayCompletions = [] } = useQuery({
    queryKey: ['habit-completions-today', todayStr],
    queryFn: async () => {
      if (!electron.isReady) return []
      
      const result = await electron.executeQuery(`
        SELECT habit_id, date 
        FROM habit_completions 
        WHERE date = ? 
        AND completed = 1
      `, [todayStr])
      return Array.isArray(result) ? result : []
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refetch every 5 seconds for instant updates
    staleTime: 0, // Always treat as stale to ensure fresh data
  })

  // Fetch completions for the selected month (for monthly overview)
  // MUST be before getHabitCompletionForDay function
  const { data: completions = [] } = useQuery({
    queryKey: ['habit-completions', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const todayDate = new Date()
      const start = getLocalDateString(startOfMonth(selectedMonth < todayDate ? selectedMonth : todayDate))
      const end = getLocalDateString(endOfMonth(selectedMonth > todayDate ? selectedMonth : todayDate))
      
      if (!electron.isReady) return []
      
      const result = await electron.executeQuery(`
        SELECT habit_id, date 
        FROM habit_completions 
        WHERE date BETWEEN ? AND ? 
        AND completed = 1
      `, [start, end])
      return Array.isArray(result) ? result : []
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true, // Refetch when returning to app to catch any date changes
    refetchInterval: 30000, // Refetch every 30 seconds for quicker sync
    staleTime: 0, // Always treat as stale to ensure fresh data
  })

  const filteredHabits = useMemo(() => habits.filter((habit: Habit) => {
    const matchesSearch = searchQuery === '' ||
      habit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      habit.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFrequency = selectedFrequency === 'all' || habit.frequency === selectedFrequency
    const matchesGoal = selectedGoal === 'all' || 
      (selectedGoal === 'none' && !habit.goal_id) ||
      habit.goal_id === selectedGoal

    return matchesSearch && matchesFrequency && matchesGoal
  }).sort((a, b) => {
    switch (sortBy) {
      case 'streak':
        return b.streak_current - a.streak_current
      case 'consistency':
        return b.consistency_score - a.consistency_score
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      default:
        return 0
    }
  }), [habits, searchQuery, selectedFrequency, selectedGoal, sortBy])

  /**
   * Returns whether a habit is completed for a given day.
   * Uses todayCompletions query for today (more frequently refreshed)
   * and completions query for other days in the month.
   */
  const getHabitCompletionForDay = (habitId: string, date: Date) => {
    const dateStr = getLocalDateString(date)
    const isToday = dateStr === todayStr
    
    // For TODAY, always use todayCompletions query (single source of truth for button state)
    if (isToday) {
      if (!Array.isArray(todayCompletions) || todayCompletions.length === 0) return false
      return todayCompletions.some((c: any) => c.habit_id === habitId && c.date && (c.date === dateStr || c.date.startsWith(dateStr)))
    }
    
    // For past/future dates, use the monthly completions
    if (!Array.isArray(completions) || completions.length === 0) return false
    return completions.some((c: any) => c.habit_id === habitId && c.date && (c.date === dateStr || c.date.startsWith(dateStr)))
  }

  // Sort habits by frequency and completion status
  // Unmarked habits first (grouped by frequency), then marked habits
  // Only sorts when on the 'all' tab, updates when switching tabs
  const sortedHabitsByFrequency = useMemo(() => {
    if (activeTab !== 'all') return filteredHabits

    const frequencyOrder = { daily: 0, weekly: 1, monthly: 2 }

    return [...filteredHabits].sort((a, b) => {
      // First, sort by frequency (daily, then weekly, then monthly)
      const frequencyDiff = frequencyOrder[a.frequency as keyof typeof frequencyOrder] - frequencyOrder[b.frequency as keyof typeof frequencyOrder]
      if (frequencyDiff !== 0) return frequencyDiff

      // Within same frequency, sort unmarked (not completed today) first
      const aCompleted = getHabitCompletionForDay(a.id, new Date())
      const bCompleted = getHabitCompletionForDay(b.id, new Date())

      // Unmarked (false) comes before marked (true)
      return (aCompleted ? 1 : 0) - (bCompleted ? 1 : 0)
    })
  }, [filteredHabits, activeTab])

  // Fetch ALL completions (for streak calculations)
  const { data: allCompletions = [] } = useQuery({
    queryKey: ['habit-completions-all'],
    queryFn: async () => {
      if (!electron.isReady) return []
      
      const result = await electron.executeQuery<any[]>(`
        SELECT habit_id, date, completed
        FROM habit_completions 
        ORDER BY date ASC
      `)
      
      return Array.isArray(result) ? result.map(r => ({
        habit_id: r.habit_id,
        date: r.date,
        completed: Boolean(r.completed)
      })) : []
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
  })

  // Generate calendar days for the selected month
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  })
  
  // Calculate statistics using centralized habit analytics (match Analytics → Habits)
  const habitDateRange = useMemo(() => getDateRange('month'), [todayStr])
  const typedAllCompletions = useMemo(() => (Array.isArray(allCompletions) ? allCompletions as HabitCompletion[] : []), [allCompletions])
  const habitAnalytics = useMemo(
    () => calculateHabitAnalytics(habits, habitDateRange, typedAllCompletions),
    [habits, habitDateRange, typedAllCompletions]
  )

  const dueTodayMetrics = useMemo(
    () => calculateHabitDueMetricsForDay(habits, typedAllCompletions, new Date(), 'short'),
    [habits, typedAllCompletions]
  )

  const habitComputedMetrics = useMemo(() => {
    const metrics = new Map<string, { streakCurrent: number; streakLongest: number; consistency: number }>()

    habits.forEach((habit) => {
      const streaks = calculateHabitStreaks(habit, typedAllCompletions)
      const completedPeriods = countHabitCompletedPeriods(habit, typedAllCompletions)
      const totalPeriods = countHabitTotalPeriods(habit)
      const consistency = totalPeriods > 0 ? Math.round((completedPeriods / totalPeriods) * 100) : 0

      metrics.set(habit.id, {
        streakCurrent: streaks.current,
        streakLongest: streaks.longest,
        consistency,
      })
    })

    return metrics
  }, [habits, typedAllCompletions])

  const consistentHabitsByHistory = useMemo(() => {
    return filteredHabits
      .filter((habit) => (habitComputedMetrics.get(habit.id)?.consistency || 0) >= 80)
      .sort(
        (a, b) =>
          (habitComputedMetrics.get(b.id)?.consistency || 0) -
          (habitComputedMetrics.get(a.id)?.consistency || 0)
      )
  }, [filteredHabits, habitComputedMetrics])

  const stats: HabitStats = useMemo(() => {
    const activeHabits = [
      ...habitAnalytics.byFrequency.daily,
      ...habitAnalytics.byFrequency.weekly,
      ...habitAnalytics.byFrequency.monthly
    ]
    // Calculate today's completion from due habits only
    const todayCompletedCount = dueTodayMetrics.completedDueHabits
    const todayExpectedCount = dueTodayMetrics.dueHabits
    
    // Calculate streaks using all active habits (respects frequency rules)
    const currentStreak = calculateCurrentHabitStreak(activeHabits, typedAllCompletions)
    const longestStreak = calculateLongestHabitStreak(activeHabits, typedAllCompletions)
    
    // Calculate check-ins (all-time period totals)
    const checkInsStats = calculateCheckInsStats(activeHabits, typedAllCompletions)
    
    return {
      total: habitAnalytics.total,
      daily: habitAnalytics.byFrequency.daily.length,
      weekly: habitAnalytics.byFrequency.weekly.length,
      monthly: habitAnalytics.byFrequency.monthly.length,
      todayCompletedCount,
      todayExpectedCount,
      todayCompletionPercentage: todayExpectedCount > 0 
        ? Math.round((todayCompletedCount / todayExpectedCount) * 100) 
        : 0,
      currentStreak,
      longestStreak,
      activeStreaks: activeHabits.filter(h => (habitComputedMetrics.get(h.id)?.streakCurrent || 0) >= 7).length,
      averageConsistency: habitAnalytics.avgConsistency,
      checkInsCompleted: checkInsStats.completed,
      checkInsTotal: checkInsStats.total,
    }
  }, [habitAnalytics, typedAllCompletions, habitComputedMetrics, dueTodayMetrics])

  const selectedMonthDueSeries = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)  // Use full month, not capped to today

    if (monthStart > monthEnd) {
      return []
    }

    const completionDatesByHabit = new Map<string, string[]>()
    typedAllCompletions
      .filter((completion) => completion.completed)
      .forEach((completion) => {
        const key = completion.habit_id
        const dateKey = completion.date.slice(0, 10)
        if (!completionDatesByHabit.has(key)) {
          completionDatesByHabit.set(key, [])
        }
        completionDatesByHabit.get(key)!.push(dateKey)
      })

    const hasCompletionBetween = (habitId: string, startKey: string, endKey: string) => {
      const dates = completionDatesByHabit.get(habitId) || []
      return dates.some((dateKey) => dateKey >= startKey && dateKey <= endKey)
    }

    const getMonthlyDueDay = (habit: Habit, referenceDay: Date): number => {
      const rawSchedule = (habit as any)?.schedule
      const parsedSchedule = Array.isArray(rawSchedule)
        ? rawSchedule
        : typeof rawSchedule === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(rawSchedule)
                return Array.isArray(parsed) ? parsed : []
              } catch {
                return []
              }
            })()
          : []

      const scheduledDate = parsedSchedule
        .map((value: any) => Number.parseInt(String(value), 10))
        .find((value: number) => Number.isFinite(value) && value >= 1 && value <= 31)

      const daysInMonth = new Date(referenceDay.getFullYear(), referenceDay.getMonth() + 1, 0).getDate()
      if (scheduledDate && Number.isFinite(scheduledDate)) {
        return Math.min(scheduledDate, daysInMonth)
      }
      return daysInMonth
    }

    const getDueMetaForDate = (dayKey: string) => {
      const referenceDate = startOfDay(safeParseDate(`${dayKey}T00:00:00`))
      const dueHabitTitles: string[] = []
      const completedDueHabitTitles: string[] = []

      habits.forEach((habit) => {
        if (!habit || habit.deleted_at) return
        const createdAt = startOfDay(safeParseDate(habit.created_at))
        if (createdAt > referenceDate) return

        if (habit.frequency === 'daily') {
          dueHabitTitles.push(habit.title)
          if (hasCompletionBetween(habit.id, dayKey, dayKey)) {
            completedDueHabitTitles.push(habit.title)
          }
          return
        }

        if (habit.frequency === 'weekly') {
          if (referenceDate.getDay() !== 0) return
          const periodStart = getLocalDateString(startOfWeek(referenceDate, { weekStartsOn: 1 }))
          dueHabitTitles.push(habit.title)
          if (hasCompletionBetween(habit.id, periodStart, dayKey)) {
            completedDueHabitTitles.push(habit.title)
          }
          return
        }

        if (habit.frequency === 'monthly') {
          const dueDay = getMonthlyDueDay(habit, referenceDate)
          if (referenceDate.getDate() !== dueDay) return
          const periodStart = getLocalDateString(startOfMonth(referenceDate))
          dueHabitTitles.push(habit.title)
          if (hasCompletionBetween(habit.id, periodStart, dayKey)) {
            completedDueHabitTitles.push(habit.title)
          }
        }
      })

      return {
        dueHabitTitles,
        completedDueHabitTitles,
      }
    }

    return calculateHabitDueSeries(habits, typedAllCompletions, { start: monthStart, end: monthEnd }, 'short').map((point) => {
      const dueMeta = getDueMetaForDate(point.fullDate)
      const dueHabits = point.dueHabits || 0
      const completedDueHabits = point.completedDueHabits || 0
      const completionRate = dueHabits > 0 ? Math.round((completedDueHabits / dueHabits) * 100) : 0
      const dayOfMonth = safeParseDate(point.fullDate + 'T00:00:00').getDate()
      
      return {
        date: point.date,
        fullDate: point.fullDate,
        dayOfMonth: dayOfMonth,
        dueHabits: dueHabits,
        completedDueHabits: completedDueHabits,
        completionRate: completionRate,
        earlyCompletedHabits: point.earlyCompletedHabits,
        dueHabitTitles: dueMeta.dueHabitTitles,
        completedDueHabitTitles: dueMeta.completedDueHabitTitles,
      }
    })
  }, [habits, selectedMonth, typedAllCompletions])

  const selectedMonthEarlyCompletions = useMemo(
    () => {
      if (!Array.isArray(typedAllCompletions) || typedAllCompletions.length === 0) return 0

      const monthStart = startOfMonth(selectedMonth)
      const monthEnd = endOfMonth(selectedMonth)  // Use full month, not capped to today

      if (monthStart > monthEnd) return 0

      const getMonthlyDueDay = (habit: Habit, referenceDay: Date): number => {
        const rawSchedule = (habit as any)?.schedule
        const parsedSchedule = Array.isArray(rawSchedule)
          ? rawSchedule
          : typeof rawSchedule === 'string'
            ? (() => {
                try {
                  const parsed = JSON.parse(rawSchedule)
                  return Array.isArray(parsed) ? parsed : []
                } catch {
                  return []
                }
              })()
            : []

        const scheduledDate = parsedSchedule
          .map((value: any) => Number.parseInt(String(value), 10))
          .find((value: number) => Number.isFinite(value) && value >= 1 && value <= 31)

        const daysInMonth = new Date(referenceDay.getFullYear(), referenceDay.getMonth() + 1, 0).getDate()
        if (scheduledDate && Number.isFinite(scheduledDate)) {
          return Math.min(scheduledDate, daysInMonth)
        }
        return daysInMonth
      }

      const completedByHabit = new Map<string, Date[]>()
      typedAllCompletions
        .filter((completion) => completion.completed)
        .forEach((completion) => {
          const dateOnly = completion.date.slice(0, 10)
          const completedDate = startOfDay(safeParseDate(`${dateOnly}T00:00:00`))
          if (completedDate < monthStart || completedDate > monthEnd) return
          if (!completedByHabit.has(completion.habit_id)) {
            completedByHabit.set(completion.habit_id, [])
          }
          completedByHabit.get(completion.habit_id)!.push(completedDate)
        })

      let earlyCount = 0

      habits.forEach((habit) => {
        if (!habit || habit.deleted_at || habit.frequency === 'daily') return
        const createdAt = startOfDay(safeParseDate(habit.created_at))
        const completionDates = completedByHabit.get(habit.id) || []
        if (completionDates.length === 0) return

        if (habit.frequency === 'weekly') {
          let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 })
          while (weekStart <= monthEnd) {
            const dueDate = endOfWeek(weekStart, { weekStartsOn: 1 })
            if (dueDate >= monthStart && dueDate <= monthEnd && dueDate >= createdAt) {
              const effectiveStart = weekStart > createdAt ? weekStart : createdAt
              const earlyHit = completionDates.some((date) => date >= effectiveStart && date < dueDate)
              if (earlyHit) {
                earlyCount += 1
              }
            }
            weekStart = startOfWeek(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7), { weekStartsOn: 1 })
          }
          return
        }

        if (habit.frequency === 'monthly') {
          const dueDay = getMonthlyDueDay(habit, monthStart)
          const dueDate = startOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth(), dueDay))
          if (dueDate < monthStart || dueDate > monthEnd || dueDate < createdAt) return
          const effectiveStart = createdAt > monthStart ? createdAt : monthStart
          const earlyHit = completionDates.some((date) => date >= effectiveStart && date < dueDate)
          if (earlyHit) {
            earlyCount += 1
          }
        }
      })

      return earlyCount
    },
    [habits, selectedMonth, typedAllCompletions]
  )

  // Calculate monthly totals for due habits
  const monthlyTotalDue = useMemo(() => {
    if (!Array.isArray(selectedMonthDueSeries)) return 0
    return selectedMonthDueSeries.reduce((sum, point) => sum + (point.dueHabits || 0), 0)
  }, [selectedMonthDueSeries])

  const monthlyTotalCompleted = useMemo(() => {
    if (!Array.isArray(selectedMonthDueSeries)) return 0
    return selectedMonthDueSeries.reduce((sum, point) => sum + (point.completedDueHabits || 0), 0)
  }, [selectedMonthDueSeries])

  // Create habit mutation
  const createHabitMutation = useMutation({
    mutationFn: async (habitData: CreateHabitDTO) => {
      const newHabitId = await database.createHabit(habitData)
      const newHabit = await database.getHabitById(newHabitId)
      return newHabit
    },
    onSuccess: (newHabit) => {
        if(newHabit) {
            addHabit(newHabit)
            // Invalidate dashboard and analytics queries
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['analytics'] })
            queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] })
            queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            success('Habit created successfully')
            setIsCreating(false)
            resetForm()
        } else {
            toastError('Failed to retrieve created habit.')
        }
    },
    onError: (error) => {
      console.error('Failed to create habit:', error)
      toastError('Failed to create habit')
    },
  })

  // Update habit mutation
  const updateHabitMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateHabitDTO }) => {
        await database.updateHabit(id, updates)
        const updatedHabit = await database.getHabitById(id)
        return updatedHabit
    },
    onSuccess: (updatedHabit) => {
        if (updatedHabit) {
            updateHabit(updatedHabit)
            // Invalidate dashboard and analytics queries
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['analytics'] })
            queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] })
            queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            success('Habit updated successfully')
            setIsEditing(null)
            resetForm()
        } else {
            toastError('Failed to retrieve updated habit.')
        }
    },
    onError: (error) => {
      console.error('Failed to update habit:', error)
      toastError('Failed to update habit')
    },
  })

  // Toggle habit completion mutation
  const toggleHabitCompletionMutation = useMutation({
    mutationFn: async ({ habitId, date, completed }: {
      habitId: string;
      date: Date;
      completed: boolean
    }) => {
      await database.setHabitCompletion(habitId, date, completed)
      const updatedHabit = await database.getHabitById(habitId)
      return updatedHabit
    },
    onMutate: async ({ habitId, date, completed }) => {
      const monthKey = format(selectedMonth, 'yyyy-MM')
      // Use local date string for consistency with database storage
      const dateStr = getLocalDateString(date)
      const queryKey = ['habit-completions', monthKey]
      const todayQueryKey = ['habit-completions-today', todayStr]
      const allQueryKey = ['habit-completions-all']

      // Cancel ongoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey })
      await queryClient.cancelQueries({ queryKey: todayQueryKey })
      await queryClient.cancelQueries({ queryKey: allQueryKey })
      
      const previousMonthly = queryClient.getQueryData<any[]>(queryKey)
      const previousToday = queryClient.getQueryData<any[]>(todayQueryKey)
      const previousAll = queryClient.getQueryData<any[]>(allQueryKey)

      // Optimistic update for monthly completions
      if (Array.isArray(previousMonthly)) {
        const withoutTarget = previousMonthly.filter((c) => !(c.habit_id === habitId && (c.date === dateStr || c.date?.startsWith(dateStr))))
        const next = completed
          ? [...withoutTarget, { habit_id: habitId, date: dateStr }]
          : withoutTarget

        queryClient.setQueryData(queryKey, next)
      }

      // Optimistic update for today's completions if this is today
      if (dateStr === todayStr && Array.isArray(previousToday)) {
        const withoutTarget = previousToday.filter((c) => !(c.habit_id === habitId && (c.date === dateStr || c.date?.startsWith(dateStr))))
        const next = completed
          ? [...withoutTarget, { habit_id: habitId, date: dateStr }]
          : withoutTarget

        queryClient.setQueryData(todayQueryKey, next)
      }

      // Optimistic update for all completions (drives streaks/check-ins/card completion state)
      if (Array.isArray(previousAll)) {
        const withoutTarget = previousAll.filter((c) => !(c.habit_id === habitId && (c.date === dateStr || c.date?.startsWith(dateStr))))
        const next = completed
          ? [...withoutTarget, { habit_id: habitId, date: dateStr, completed: true }]
          : withoutTarget

        queryClient.setQueryData(allQueryKey, next)
      }

      return { previousMonthly, previousToday, previousAll, queryKey, todayQueryKey, allQueryKey, dateStr }
    },
    onError: (error, _variables, context) => {
      console.error('Failed to toggle habit completion:', error)
      toastError('Failed to update habit')
      // Rollback both optimistic updates
      if (context?.previousMonthly && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousMonthly)
      }
      if (context?.previousToday && context.todayQueryKey) {
        queryClient.setQueryData(context.todayQueryKey, context.previousToday)
      }
      if (context?.previousAll && context.allQueryKey) {
        queryClient.setQueryData(context.allQueryKey, context.previousAll)
      }
    },
    onSuccess: async (updatedHabit, variables) => {
      if (updatedHabit) {
        updateHabit(updatedHabit)
        
        const currentMonthKey = format(new Date(), 'yyyy-MM')
        const selectedMonthKey = format(selectedMonth, 'yyyy-MM')
        const currentTodayKey = getLocalDateString(new Date())
        
        // Refetch TODAY's completions FIRST and WAIT for it (critical for button state)
        await queryClient.refetchQueries({ 
          queryKey: ['habit-completions-today', currentTodayKey]
        })
        
        // Then refetch the monthly views in parallel
        const monthlyRefetches = []
        
        monthlyRefetches.push(
          queryClient.refetchQueries({ 
            queryKey: ['habit-completions', currentMonthKey]
          })
        )
        
        if (selectedMonthKey !== currentMonthKey) {
          monthlyRefetches.push(
            queryClient.refetchQueries({ 
              queryKey: ['habit-completions', selectedMonthKey]
            })
          )
        }
        
        monthlyRefetches.push(
          queryClient.refetchQueries({ queryKey: ['habit-completions-30d'] })
        )

        monthlyRefetches.push(
          queryClient.refetchQueries({ queryKey: ['habit-completions-all'] })
        )
        
        await Promise.all(monthlyRefetches)
        
        // Invalidate remaining queries for consistency across the app
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
        queryClient.invalidateQueries({ queryKey: ['review-insights'] })
        queryClient.invalidateQueries({ queryKey: ['habits'] })
        queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] })
        queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        queryClient.invalidateQueries({ queryKey: ['task-tab-stats-snapshot'] })
        
        if (variables.completed) {
          success('Habit marked as complete')
        } else {
          success('Habit marked as undone')
        }
      }
    },
  })

  // Archive habit mutation - preserves completion history
  const deleteHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      await database.archiveHabit(id)
      return id
    },
    onSuccess: (id) => {
      archiveHabit(id)
      // Invalidate archive queries so it shows up in archive
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] })
      queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['task-tab-stats-snapshot'] })
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      success('Habit archived. Completion history preserved.')
    },
    onError: (error) => {
      console.error('Failed to archive habit:', error)
      toastError('Failed to archive habit')
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      frequency: '', // Empty by default - user must select
      schedule: [],
      goal_id: '',
      tags: [],
    })
    setFormErrors({})
    setNewTag('')
  }

  const handleEdit = (habit: Habit) => {
    setIsEditing(habit.id)
    setFormData({
      title: habit.title,
      description: habit.description || '',
      frequency: habit.frequency,
      schedule: [],
      goal_id: habit.goal_id || '',
      tags: (habit as any).tags || [],
    })
    setIsCreating(true)
  }

  const handleSubmit = () => {
    // Clear previous errors
    setFormErrors({})
    
    // Manual validation for Title and Frequency
    const errors: { [key: string]: string } = {}
    
    if (!formData.title.trim()) {
      errors.title = 'Habit title is required'
    }
    
    if (!formData.frequency) {
      errors.frequency = 'Please select a frequency'
    }
    
    // Use comprehensive validation utility for additional checks
    const validation = validateHabitForm(formData)
    
    if (!validation.isValid) {
      Object.assign(errors, validation.errors)
    }
    
    // If there are errors, display them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      // Show toast with first error
      const firstError = Object.values(errors)[0]
      if (firstError) toastError(firstError)
      return
    }

    if (isEditing) {
      updateHabitMutation.mutate({
        id: isEditing,
        updates: {
          ...formData,
          frequency: formData.frequency as Habit['frequency'],
        },
      })
    } else {
      createHabitMutation.mutate({
        ...formData,
        frequency: formData.frequency as Habit['frequency'],
      })
    }
  }

  const isMonthlyOverviewDateMarkable = (date: Date, habitCreatedAt?: string) => {
    if (!habitCreatedAt) return false

    const today = startOfDay(new Date())
    const yesterday = startOfDay(subDays(today, 1))
    const candidate = startOfDay(date)
    const createdDay = startOfDay(safeParseDate(habitCreatedAt))

    if (candidate.getTime() > today.getTime()) return false
    if (candidate.getTime() < createdDay.getTime()) return false

    if (candidate.getTime() !== today.getTime() && candidate.getTime() !== yesterday.getTime()) {
      return false
    }

    if (createdDay.getTime() === today.getTime() && candidate.getTime() === yesterday.getTime()) {
      return false
    }

    return true
  }

  const getPeriodCompletionDate = (habit: Habit, anchorDate: Date): Date | null => {
    const targetDay = startOfDay(anchorDate)

    if (habit.frequency === 'daily') {
      const targetKey = getLocalDateString(targetDay)
      const isCompleted = typedAllCompletions.some((completion) => (
        completion.completed &&
        completion.habit_id === habit.id &&
        completion.date.slice(0, 10) === targetKey
      ))
      return isCompleted ? targetDay : null
    }

    const start = habit.frequency === 'weekly'
      ? startOfWeek(targetDay, { weekStartsOn: 1 })
      : startOfMonth(targetDay)
    const end = habit.frequency === 'weekly'
      ? endOfWeek(targetDay, { weekStartsOn: 1 })
      : endOfMonth(targetDay)

    const candidate = typedAllCompletions.find((completion) => {
      if (!completion.completed || completion.habit_id !== habit.id) return false
      const completionDate = startOfDay(safeParseDate(completion.date))
      return completionDate >= start && completionDate <= end
    })

    if (!candidate) return null
    return startOfDay(safeParseDate(candidate.date))
  }

  /**
   * Handles toggling habit completion with proper validation.
   */
  const handleToggleCompletion = (
    habitId: string,
    date: Date,
    currentlyCompleted: boolean,
    habitCreatedAt?: string,
    enforceMonthlyOverviewWindow: boolean = false
  ) => {
    const dateStr = getLocalDateString(date)
    const todayLocal = getLocalDateString(new Date())
    
    // Prevent future dates
    if (dateStr > todayLocal) {
      console.warn('[HABIT] Cannot mark future date as completed')
      return
    }
    
    // Prevent marking dates before habit creation
    if (habitCreatedAt) {
      const creationDate = getLocalDateString(safeParseDate(habitCreatedAt))
      if (dateStr < creationDate) {
        console.warn('[HABIT] Cannot mark date before habit creation:', dateStr, 'created:', creationDate)
        return
      }

      // Monthly overview restriction: only today and one day back can be toggled
      if (enforceMonthlyOverviewWindow && !isMonthlyOverviewDateMarkable(date, habitCreatedAt)) {
        console.warn('[HABIT] Date not markable by monthly overview rule:', dateStr)
        return
      }
    }
    
    toggleHabitCompletionMutation.mutate({
      habitId,
      date,
      completed: !currentlyCompleted,
    })
  }

  const renderHabitCard = (habit: Habit) => {
    const todayDate = new Date()
    const completionDateForPeriod = getPeriodCompletionDate(habit, todayDate)
    const isCompletedForAction = completionDateForPeriod !== null
    const computedMetric = habitComputedMetrics.get(habit.id)
    const streakCurrent = computedMetric?.streakCurrent ?? 0
    const streakLongest = computedMetric?.streakLongest ?? 0
    const consistencyScore = computedMetric?.consistency ?? 0
    const habitTags = (habit as any).tags || []
    
    // Use habit.id and completion state as cache key to force re-render
    const cardKey = `${habit.id}-${isCompletedForAction}`
    
    // Determine streak color intensity
    const getStreakColor = (streak: number) => {
      if (streak >= 30) return "text-orange-500 fill-orange-500"
      if (streak >= 14) return "text-orange-400 fill-orange-400"
      if (streak >= 7) return "text-yellow-500 fill-yellow-500"
      return "text-muted-foreground"
    }
    
    // Determine consistency color
    const getConsistencyColor = (score: number) => {
      if (score >= 80) return "text-green-500"
      if (score >= 60) return "text-blue-500"
      if (score >= 40) return "text-yellow-500"
      return "text-gray-500"
    }

    return (
    <Card 
      key={cardKey} 
      className={cn(
        "overflow-hidden transition-all duration-300 group",
        "bg-gradient-to-br from-card to-card/80",
        "border-0 shadow-md hover:shadow-lg",
        isCompletedForAction && "ring-2 ring-green-500/30"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate text-base flex items-center gap-2">
              {habit.title}
              {isCompletedForAction && (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              )}
            </CardTitle>
            <CardDescription className="truncate text-xs">
              {habit.description || 'Build this habit consistently'}
            </CardDescription>
            <div className="mt-1 text-xs text-muted-foreground">
              Created: {format(safeParseDate(habit.created_at), 'MMM d, yyyy, h:mm a')}
            </div>
          </div>
          {/* Direct Action Icons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 hover:bg-primary/10"
              onClick={() => handleEdit(habit)}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 hover:bg-orange-500/10 text-orange-500"
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Habit</AlertDialogTitle>
                  <AlertDialogDescription>
                    This habit will be moved to the Archive. You can restore it later from the Archive section.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteHabitMutation.mutate(habit.id)}
                    className="bg-orange-500 text-white hover:bg-orange-600"
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <Badge 
            className={cn(
              "text-[10px] px-2 py-1 h-5 font-medium border-0",
              habit.frequency === 'daily' && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
              habit.frequency === 'weekly' && "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
              habit.frequency === 'monthly' && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            )}
          >
            {habit.frequency}
          </Badge>
          {habit.goal_id && (
            <Badge 
              className="text-[10px] px-2 py-1 h-5 font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0"
            >
              <Target className="mr-1 h-3 w-3" />
              {goals.find(g => g.id === habit.goal_id)?.title?.slice(0, 15)}...
            </Badge>
          )}
          {habitTags.slice(0, 2).map((tag: string) => (
            <Badge 
              key={tag} 
              className="text-[10px] px-2 py-1 h-5 font-medium bg-slate-200 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Stats with Colored Icons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Streak */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-gradient-to-br from-orange-500/5 to-orange-500/10"
          )}>
            <div className="flex items-center gap-2">
              <Flame className={cn("h-6 w-6", getStreakColor(streakCurrent))} />
              <div>
                <div className="text-xl font-bold">{streakCurrent}</div>
                <div className="text-[10px] text-muted-foreground">Current Streak</div>
              </div>
            </div>
            {streakLongest > streakCurrent && (
              <div className="text-[10px] text-muted-foreground mt-1">
                Best: {streakLongest} days
              </div>
            )}
          </div>

          {/* Consistency */}
          <div className={cn(
            "p-3 rounded-lg",
            "bg-gradient-to-br from-blue-500/5 to-blue-500/10"
          )}>
            <div className="flex items-center gap-2">
              <TrendingUp className={cn("h-6 w-6", getConsistencyColor(consistencyScore))} />
              <div>
                <div className={cn("text-xl font-bold", getConsistencyColor(consistencyScore))}>
                  {Math.round(consistencyScore)}%
                </div>
                <div className="text-[10px] text-muted-foreground">Consistency</div>
              </div>
            </div>
            <Progress 
              value={consistencyScore} 
              className="h-1.5 mt-2"
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full bg-transparent dark:bg-transparent transition-all duration-200",
            isCompletedForAction 
              ? "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 dark:bg-transparent dark:text-green-300 dark:border-green-500/35 dark:hover:bg-red-500/20 dark:hover:text-red-200 dark:hover:border-red-500/45" 
              : "text-green-700 border-green-500/40 hover:bg-green-500/10 hover:text-green-700 hover:border-green-500/50 dark:bg-transparent dark:text-zinc-100 dark:border-zinc-700/70 dark:hover:bg-green-500/20 dark:hover:text-green-200 dark:hover:border-green-500/45"
          )}
          disabled={toggleHabitCompletionMutation.isPending}
          onClick={() => {
            if (isCompletedForAction) {
              setHabitPendingUndoneConfirm(habit)
              return
            }

            handleToggleCompletion(habit.id, todayDate, false, habit.created_at)
          }}
        >
          {isCompletedForAction ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Mark as Undone
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Done
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )}

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-3xl font-bold">Habits</h1>
            <ContextTipsDialog
              title="Habit Tab Tips"
              description="Understand habit purpose, consistency, streak behavior, and how to use each frequency effectively."
              sections={HABIT_TIPS_SECTIONS}
              triggerLabel="Open habit tips"
            />
          </div>
          <p className="text-muted-foreground">
            Build consistency through daily practices
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />
              New Habit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-card">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{isEditing ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
              <DialogDescription>
                Define a recurring practice to build consistency.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2 scroll-smooth">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Habit Title
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <Input
                    placeholder="What habit do you want to build?"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value })
                      // Clear error when user starts typing
                      if (formErrors.title) {
                        setFormErrors({ ...formErrors, title: '' })
                      }
                    }}
                    className={`bg-secondary/50 focus-visible:ring-green-500/50 dark:border-green-500/15 ${
                      formErrors.title
                        ? 'border-red-500/50 focus-visible:ring-red-500/50'
                        : 'border-green-500/20'
                    }`}
                  />
                  {formErrors.title && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.title}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Why is this habit important?"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Frequency
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <Select
                      value={formData.frequency || undefined}
                      onValueChange={(value: any) => {
                        // When changing frequency, clear schedule if not weekly
                        const newSchedule = value === 'weekly' ? formData.schedule : []
                        setFormData({ ...formData, frequency: value, schedule: newSchedule })
                        // Clear error when user selects
                        if (formErrors.frequency) {
                          setFormErrors({ ...formErrors, frequency: '' })
                        }
                      }}
                    >
                      <SelectTrigger className={`bg-secondary/50 focus:ring-green-500/50 dark:border-green-500/15 ${
                        formErrors.frequency
                          ? 'border-red-500/50 focus:ring-red-500/50'
                          : 'border-green-500/20'
                      }`}>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.frequency && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.frequency}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Related Goal (Optional)</label>
                    <Select
                      value={formData.goal_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, goal_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                        <SelectValue placeholder="Select a goal..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Goal</SelectItem>
                        {goals?.map((goal) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            {goal.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tags Section with Add Button */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag (e.g., health, productivity)"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
                            setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
                            setNewTag('')
                          }
                        }
                      }}
                      className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                    />
                    <Button 
                      type="button" 
                      variant="secondary"
                      onClick={() => {
                        if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
                          setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
                          setNewTag('')
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })}
                            className="ml-1 hover:text-destructive"
                          >
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
                setFormErrors({})
              }} className="bg-transparent dark:bg-transparent border-green-500/30 text-green-600 dark:text-green-300 hover:bg-green-500/10 hover:border-green-500/50 transition-colors duration-200">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createHabitMutation.isPending || updateHabitMutation.isPending}
              >
                {isEditing ? 'Update Habit' : 'Create Habit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Structure: Total Habits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Habits</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.daily} daily, {stats.weekly} weekly, {stats.monthly} monthly
            </p>
          </CardContent>
        </Card>

        {/* Today: Daily Feedback - DAILY HABITS ONLY */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Progress</CardTitle>
            <Target className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-500">{stats.todayCompletionPercentage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.todayCompletedCount} / {stats.todayExpectedCount} due habits
            </p>
            <Progress value={stats.todayCompletionPercentage} className="mt-2" />
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.currentStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.currentStreak} days
            </p>
            {stats.longestStreak > 0 && (
              <p className="text-xs text-orange-600 mt-1 font-medium">
                Longest: {stats.longestStreak} days
              </p>
            )}
          </CardContent>
        </Card>

        {/* Reliability: Avg Consistency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Consistency</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.averageConsistency}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 30 days
            </p>
            <Progress value={stats.averageConsistency} className="mt-2" />
          </CardContent>
        </Card>

        {/* Check-ins */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-ins</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stats.checkInsCompleted}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              out of {stats.checkInsTotal}
            </p>
            <Progress
              value={stats.checkInsTotal > 0 ? Math.round((stats.checkInsCompleted / stats.checkInsTotal) * 100) : 0}
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Habits List */}
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/30 dark:bg-secondary/20">
          <TabsTrigger value="all">All Habits ({filteredHabits.length})</TabsTrigger>
          <TabsTrigger value="streaks">Active Streaks ({stats.activeStreaks})</TabsTrigger>
          <TabsTrigger value="consistency">Consistency (80%+)</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {filteredHabits.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No habits found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedFrequency !== 'all' || selectedGoal !== 'all'
                    ? 'Try changing your filters or search query'
                    : 'Create your first habit to build consistency!'}
                </p>
                {!searchQuery && selectedFrequency === 'all' && selectedGoal === 'all' && (
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Habit
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {(['daily', 'weekly', 'monthly'] as const).map((frequency) => {
                const habitsByFrequency = sortedHabitsByFrequency.filter(h => h.frequency === frequency)
                if (habitsByFrequency.length === 0) return null

                return (
                  <div key={frequency}>
                    <h3 className="text-lg font-semibold mb-4 capitalize text-foreground">{frequency} Habits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {habitsByFrequency.map(renderHabitCard)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="streaks" className="mt-6">
          {(() => {
            const streakHabits = filteredHabits.filter(h => (habitComputedMetrics.get(h.id)?.streakCurrent || 0) >= 7);
            if (streakHabits.length === 0) {
              return (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No active streaks</h3>
                    <p className="text-muted-foreground">
                      Complete habits for 7 consecutive days to build a streak!
                    </p>
                  </CardContent>
                </Card>
              )
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {streakHabits.map(renderHabitCard)}
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="consistency" className="mt-6">
          {(() => {
            if (consistentHabitsByHistory.length === 0) {
              return (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No high consistency habits</h3>
                    <p className="text-muted-foreground">
                      Keep completing your habits to improve your consistency score!
                    </p>
                  </CardContent>
                </Card>
              )
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {consistentHabitsByHistory.map(renderHabitCard)}
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>

      {/* Monthly Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Monthly Overview</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                className="bg-secondary/50 border border-green-500/20 hover:bg-secondary/70 dark:bg-secondary/30 dark:border-green-500/15 dark:hover:bg-secondary/50"
              >
                Previous
              </Button>
              <span className="font-medium">
                {format(selectedMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                className="bg-secondary/50 border border-green-500/20 hover:bg-secondary/70 dark:bg-secondary/30 dark:border-green-500/15 dark:hover:bg-secondary/50"
              >
                Next
              </Button>
            </div>
          </div>
          <CardDescription>
            Track daily habit completion for {format(selectedMonth, 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2 scrollbar-hide">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left p-2 min-w-[120px] text-base font-medium text-muted-foreground bg-muted/30 rounded-tl-lg rounded-bl-lg">Habit</th>
                  {calendarDays.map(day => {
                    const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    return (
                      <th 
                        key={day.toISOString()} 
                        className="text-center p-1 min-w-[24px] bg-muted/30"
                      >
                        <div className={cn(
                          "flex flex-col items-center gap-0.5",
                          isToday && "font-bold"
                        )}>
                          <span className={cn(
                            "text-sm font-medium",
                            isToday && "text-primary"
                          )}>{format(day, 'd')}</span>
                          <span className={cn(
                            "text-xs uppercase",
                            isToday ? "text-primary font-semibold" : "text-muted-foreground"
                          )}>{format(day, 'EEEEE')}</span>
                        </div>
                      </th>
                    )
                  })}
                  <th className="text-center p-2 min-w-[40px] text-sm font-medium text-muted-foreground">
                    <Flame className="h-4 w-4 mx-auto text-orange-500" />
                  </th>
                  <th className="text-center p-2 min-w-[60px] text-sm font-medium text-muted-foreground">
                    <TrendingUp className="h-4 w-4 mx-auto text-blue-500" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHabits.filter((habit: Habit) => habit.frequency === 'daily').slice(0, 10).map((habit: Habit) => (
                  <tr key={habit.id} className="group transition-colors">
                    <td className="p-2 bg-muted/30 rounded-l-lg rounded-r-none my-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-base truncate max-w-[120px]" title={habit.title}>{habit.title}</div>
                      </div>
                    </td>
                    {calendarDays.map(day => {
                      const isCompleted = getHabitCompletionForDay(habit.id, day)
                      const isFuture = isAfter(day, startOfDay(new Date()))
                      const dayStr = getLocalDateString(day)
                      const isToday = dayStr === todayStr
                      const isMarkable = isMonthlyOverviewDateMarkable(day, habit.created_at)
                      const isDisabled = isFuture || !isMarkable

                      return (
                        <td 
                          key={day.toISOString()} 
                          className="text-center p-0.5 transition-colors"
                        >
                          <button
                            onClick={() => {
                              if (!isDisabled) {
                                handleToggleCompletion(habit.id, day, isCompleted, habit.created_at, true)
                              }
                            }}
                            disabled={isDisabled}
                            className={cn(
                              "h-6 w-6 rounded-md flex items-center justify-center mx-auto transition-all duration-200",
                              isCompleted
                                ? "text-orange-500"
                                : isToday
                                ? "text-primary"
                                : "hover:bg-muted/20 text-muted-foreground",
                              isDisabled && !isCompleted && "opacity-40 cursor-not-allowed",
                              !isDisabled && !isCompleted && "cursor-pointer hover:scale-110"
                            )}
                            title={
                              isFuture 
                                ? `${format(day, 'MMM d, yyyy')} - Future date` 
                                : !isMarkable
                                ? `${format(day, 'MMM d, yyyy')} - Only today and one day back are clickable` 
                                : `${format(day, 'MMM d, yyyy')} - Click to mark as ${isCompleted ? 'undone' : 'done'}`
                            }
                          >
                            {isCompleted && <Flame className="h-4 w-4 text-orange-500 fill-orange-500 pointer-events-none select-none" />}
                            {!isCompleted && isToday && <div className="h-1.5 w-1.5 rounded-full bg-primary mx-auto" />}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-center p-2 rounded-none">
                      {(() => {
                        const streakCurrent = habitComputedMetrics.get(habit.id)?.streakCurrent || 0
                        return (
                      <div className="flex items-center justify-center pointer-events-none select-none">
                        {streakCurrent > 0 && (
                          <Flame className={cn(
                            "h-4 w-4 mr-1",
                            streakCurrent >= 30 && "text-orange-500 fill-orange-500",
                            streakCurrent >= 14 && streakCurrent < 30 && "text-orange-400 fill-orange-400",
                            streakCurrent >= 7 && streakCurrent < 14 && "text-yellow-500 fill-yellow-500",
                            streakCurrent < 7 && "text-muted-foreground"
                          )} />
                        )}
                        <span className={cn(
                          "font-semibold text-base",
                          streakCurrent >= 30 && "text-orange-500",
                          streakCurrent >= 14 && streakCurrent < 30 && "text-orange-400",
                          streakCurrent >= 7 && streakCurrent < 14 && "text-yellow-500",
                          streakCurrent < 7 && "text-muted-foreground"
                        )}>{streakCurrent}</span>
                      </div>
                        )
                      })()}
                    </td>
                    <td className="text-center p-2 rounded-r-lg rounded-l-none">
                      {(() => {
                        const consistency = habitComputedMetrics.get(habit.id)?.consistency || 0
                        return (
                      <div className="flex items-center justify-center">
                        <TrendingUp className={cn(
                          "h-4 w-4 mr-1",
                          consistency >= 80 && "text-green-500",
                          consistency >= 60 && consistency < 80 && "text-blue-500",
                          consistency >= 40 && consistency < 60 && "text-yellow-500",
                          consistency < 40 && "text-gray-500"
                        )} />
                        <span className={cn(
                          "text-base font-medium",
                          consistency >= 80 && "text-green-500",
                          consistency >= 60 && consistency < 80 && "text-blue-500",
                          consistency >= 40 && consistency < 60 && "text-yellow-500",
                          consistency < 40 && "text-gray-500"
                        )}>
                          {Math.round(consistency)}%
                        </span>
                      </div>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Due Habit Graph
            </CardTitle>
            <div className="text-xs font-medium text-muted-foreground">Rolling 30 days</div>
          </div>
          <CardDescription className="text-sm">Due vs Completed habits per day</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-6 px-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Completed / Due:</div>
            <div className="text-sm font-semibold">{monthlyTotalCompleted} / {monthlyTotalDue}</div>
          </div>
          <div className="h-48">
            {selectedMonthDueSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedMonthDueSeries} margin={{ top: 5, right: 12, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dayOfMonth" 
                    type="number"
                    domain={[1, new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate()]}
                    ticks={(() => {
                      const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate()
                      const ticks = []
                      // Show ticks for all dates in the month
                      for (let i = 1; i <= daysInMonth; i++) ticks.push(i)
                      return ticks
                    })()}
                    className="text-xs" 
                  />
                  <YAxis className="text-xs" />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0]?.payload
                        return (
                          <div className="rounded-lg border bg-popover p-3 shadow-lg">
                            <p className="font-semibold text-sm mb-2">Day {data?.dayOfMonth}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Due:</span>
                                <span className="font-bold">{data?.dueHabits || 0}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Completed:</span>
                                <span className="font-bold">{data?.completedDueHabits || 0}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Completion Rate:</span>
                                <span className="font-bold">{data?.completionRate || 0}%</span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="dueHabits" 
                    name="Due Habits"
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                    isAnimationActive={true}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completedDueHabits" 
                    name="Completed"
                    stroke="#22c55e" 
                    fill="#22c55e" 
                    fillOpacity={0.4}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No due-habit data available
              </div>
            )}
          </div>
          {selectedMonthEarlyCompletions > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">Completed Early ✓ {selectedMonthEarlyCompletions}</div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={habitPendingUndoneConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHabitPendingUndoneConfirm(null)
          }
        }}
      >
        <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark habit as undone?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the current completion for {habitPendingUndoneConfirm?.title || 'this habit'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!habitPendingUndoneConfirm) return
                const completionDate = getPeriodCompletionDate(habitPendingUndoneConfirm, new Date())
                if (!completionDate) {
                  setHabitPendingUndoneConfirm(null)
                  return
                }

                handleToggleCompletion(
                  habitPendingUndoneConfirm.id,
                  completionDate,
                  true,
                  habitPendingUndoneConfirm.created_at
                )
                setHabitPendingUndoneConfirm(null)
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Mark as Undone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

