import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  CheckCircle, 
  TrendingUp, 
  Target, 
  AlertCircle,
  CalendarDays,
  ArrowUpRight,
  Flame,
  Award,
  Lightbulb,
  AlertTriangle,
  Calendar,
  BarChart3,
  ListTodo,
  Plus,
  BookOpen,
  X,
  CheckSquare,
} from 'lucide-react'
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { useStore } from '@/store'
import { HabitTracker } from '@/components/habit-tracker'
import { TaskList } from '@/components/task-list'
import { QuickActions } from '@/components/quick-actions'
import { ReviewBanner, ReviewReminder } from '@/components/review-reminder'
import { cn } from '@/lib/utils'
import { Task, Goal, Habit, HabitCompletion, TaskDurationType, Priority } from '@/types'
import { database, CreateTaskDTO, getLocalDateString, TaskTabStatsSnapshot } from '@/lib/database'
import {
  calculateTaskAnalytics,
  calculateHabitAnalytics,
  calculateHabitDueMetricsForDay,
  calculateHabitDueSeries,
  calculateProductivityScore,
  calculateTrendData,
  calculateGoalProgress
} from '@/lib/progress'
import { getTodaysTasks, isTaskPausedOnDate } from '@/lib/daily-reset'
import { 
  isWeeklyHabitCompletedThisWeekPersistent,
  isMonthlyHabitCompletedThisMonthPersistent
} from '@/lib/habit-logic'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

// Types
interface Achievement {
  type: 'goal_completed' | 'streak_achieved';
  title: string;
  timestamp: string; // ISO string
}

interface HabitWithCompletion extends Habit {
  today_completed: boolean;
}

interface DashboardData {
  tasks: Task[];
  goals: Goal[];
  completedGoals: Goal[];
  habits: HabitWithCompletion[];
  achievements: Achievement[];
  habitCompletions: HabitCompletion[];
}

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-popover p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between space-x-4 text-sm">
            <div className="flex items-center">
              <div 
                className="mr-2 h-2 w-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
            </div>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// Task form data interface
interface TaskFormData {
  title: string
  description: string
  due_date: string
  priority: Priority
  estimated_time: string
  goal_id: string
  duration_type: TaskDurationType
  tags: string[]
}

const getInitialFormData = (): TaskFormData => ({
  title: '',
  description: '',
  due_date: format(new Date(), 'yyyy-MM-dd'),
  priority: 'medium',
  estimated_time: '',
  goal_id: '',
  duration_type: 'today',
  tags: [],
})

const safeParseISO = (value?: string | null): Date | null => {
  if (!value) return null
  try {
    return parseISO(value)
  } catch {
    return null
  }
}

const isDateInRange = (date: Date | null, start: Date, end: Date) => {
  if (!date) return false
  return date >= start && date <= end
}

const toDayKey = (value?: string | null): string => {
  if (!value) return getLocalDateString(new Date())
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = safeParseISO(value)
  return parsed ? getLocalDateString(parsed) : getLocalDateString(new Date(value))
}

const isSkippedOrEmptyEntry = (entry: { progress?: number | null; status?: string | null }): boolean => {
  const status = entry.status || 'pending'
  const progress = entry.progress ?? 0
  return status === 'skipped' || (progress <= 0 && status !== 'completed')
}

const isTaskSkippedOrOverdueForDay = (task: Task, dayKey: string, todayKey: string): boolean => {
  if (dayKey >= todayKey) return false

  const createdKey = toDayKey(task.created_at)
  if (createdKey > dayKey) return false
  if ((task.duration_type || 'today') !== 'continuous' && createdKey !== dayKey) return false

  if (isTaskPausedOnDate(task, parseISO(`${dayKey}T00:00:00`))) return false

  const dayState = task.daily_progress?.[dayKey]
  const status = dayState?.status ?? (dayKey === todayKey ? task.status : 'pending')
  const progress = dayState?.progress ?? (dayKey === todayKey ? (task.progress || 0) : 0)

  return isSkippedOrEmptyEntry({ status, progress })
}

const calculateHabitRangeMetrics = (
  habits: Habit[],
  completions: HabitCompletion[],
  range: { start: Date; end: Date }
) => {
  const analytics = calculateHabitAnalytics(habits, range, completions)

  return {
    activeHabits: analytics.total,
    expectedPeriods: analytics.expectedPeriods,
    completedPeriods: analytics.completedPeriods,
    consistency: analytics.avgConsistency,
    completedHabitsCount: analytics.completedHabitsCount,
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const electron = useElectron()
  const queryClient = useQueryClient()
  const { error: toastError, success: toastSuccess } = useToaster()
  const { tasks, habits, goals, updateTask, addTask, archiveTask } = useStore()
  const today = new Date()
  
  const [chartTab, setChartTab] = useState<'tasks' | 'habits' | 'productivity' | 'goals'>('productivity')
  const [analyticsWeekOffset, setAnalyticsWeekOffset] = useState(0) // 0 = this week, -1 = last week, -2 = 2 weeks ago, etc.
  const [timeOfDay, setTimeOfDay] = useState('')
  const [greeting, setGreeting] = useState('')
  
  // Task creation dialog state
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [taskFormData, setTaskFormData] = useState<TaskFormData>(getInitialFormData())
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [taskToArchive, setTaskToArchive] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  
  // Use local date string consistently to avoid timezone issues
  const todayStr = useMemo(() => getLocalDateString(today), [today])

  // Get TODAY's tasks using daily reset logic
  // - Shows today-only tasks created today
  // - Shows continuous tasks (they reset daily)
  // - Excludes yesterday and older tasks completely
  // - Maintains task history in daily_progress for analytics
  const allTodaysTasks = useMemo(() => {
    const todaysTasksList = getTodaysTasks(tasks)
    
    // Filter out paused tasks
    const activeTasksList = todaysTasksList.filter(task => !isTaskPausedOnDate(task, startOfDay(today)))
    
    // Sort: incomplete first (by priority), then completed at bottom
    return activeTasksList.sort((a, b) => {
      // Completed tasks go to the bottom
      const aCompleted = (a.progress || 0) === 100
      const bCompleted = (b.progress || 0) === 100
      if (aCompleted && !bCompleted) return 1
      if (!aCompleted && bCompleted) return -1
      // Then sort by priority
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    })
  }, [tasks])

  // Fetch dashboard data from database with real habits completion status
  // Query key includes tasks/habits/goals so it updates when store changes
  const { data: dashboardData, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', todayStr, tasks.length, habits.length, goals.length],
    queryFn: async () => {
      try {
        // Use global store tasks instead of fetching separately
        // This ensures Dashboard and Tasks tab are in sync
        const tasksResult = tasks

        // Fetch active goals
        const goalsResult = await electron.executeQuery<Goal[]>(`
          SELECT * FROM goals 
          WHERE status = 'active'
          AND deleted_at IS NULL
          ORDER BY 
            CASE priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            target_date ASC
          LIMIT 5
        `)

        // Fetch completed goals for analytics graphs (full history, real DB values)
        const completedGoalsResult = await electron.executeQuery<Goal[]>(`
          SELECT * FROM goals
          WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND deleted_at IS NULL
          ORDER BY completed_at DESC
        `)

        // IMPORTANT: Fetch today's habits with their completion status from habit_completions table
        // This ensures checked habits persist after page refresh
        // Uses local date string to avoid timezone issues
        // Include: daily, weekly, and monthly habits (weekly/monthly are visible until done)
        const rawHabits = await electron.executeQuery<any[]>(`
          SELECT h.*, 
                 (SELECT completed FROM habit_completions 
                  WHERE habit_id = h.id AND date = ?) as today_completed
          FROM habits h
          WHERE h.deleted_at IS NULL
          AND h.frequency IN ('daily', 'weekly', 'monthly')
          ORDER BY h.consistency_score DESC
        `, [todayStr])

        const habitsResult = (Array.isArray(rawHabits) ? rawHabits : []).map((h: any) => ({
          ...h,
          today_completed: !!h.today_completed,
          schedule: typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
        }))

        // Fetch full completion history from the same database API used by Habits tab
        const earliestHabitDate = habitsResult.length > 0
          ? habitsResult
              .map((habit) => {
                try {
                  return getLocalDateString(parseISO(habit.created_at))
                } catch {
                  return todayStr
                }
              })
              .sort()[0]
          : todayStr

        const habitCompletions = await database.getHabitCompletions(earliestHabitDate, todayStr)

        // Fetch recent achievements
        const achievements = await electron.executeQuery<Achievement[]>(`
          SELECT 
            'goal_completed' as type,
            title,
            completed_at as timestamp
          FROM goals 
          WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND deleted_at IS NULL
          UNION ALL
          SELECT 
            'streak_achieved' as type,
            title || ' - ' || streak_current || ' day streak' as title,
            updated_at as timestamp
          FROM habits 
          WHERE streak_current >= 7
          AND deleted_at IS NULL
          ORDER BY timestamp DESC
          LIMIT 3
        `)

        return { 
          tasks: Array.isArray(tasksResult) ? tasksResult : [], 
          goals: Array.isArray(goalsResult) ? goalsResult : [], 
          completedGoals: Array.isArray(completedGoalsResult) ? completedGoalsResult : [],
          habits: habitsResult, 
          achievements: Array.isArray(achievements) ? achievements : [],
          habitCompletions: Array.isArray(habitCompletions) ? habitCompletions : []
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        toastError('Failed to fetch dashboard data')
        throw error
      }
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000, // 30 seconds - more frequent updates
  })

  // Fetch TaskTabStats - same as Task Tab uses for consistent data
  const { data: statsSnapshot } = useQuery<TaskTabStatsSnapshot>({
    queryKey: ['task-stats', todayStr],
    queryFn: () => database.getTaskTabStats(),
    staleTime: 30 * 1000,
    enabled: electron.isReady,
  })

  const weeklyReviewPeriod = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: 1 })
    const end = endOfWeek(today, { weekStartsOn: 1 })
    return { start: start.toISOString(), end: end.toISOString() }
  }, [today])

  const monthlyReviewPeriod = useMemo(() => {
    const start = startOfMonth(today)
    const end = endOfMonth(today)
    return { start: start.toISOString(), end: end.toISOString() }
  }, [today])

  const { data: weeklyReviewDueCheck } = useQuery({
    queryKey: ['review-check', 'weekly-dashboard-alert', weeklyReviewPeriod.start, weeklyReviewPeriod.end],
    queryFn: () => database.getReviewForPeriod('weekly', weeklyReviewPeriod.start, weeklyReviewPeriod.end),
    staleTime: 60_000,
    enabled: electron.isReady,
  })

  const { data: monthlyReviewDueCheck } = useQuery({
    queryKey: ['review-check', 'monthly-dashboard-alert', monthlyReviewPeriod.start, monthlyReviewPeriod.end],
    queryFn: () => database.getReviewForPeriod('monthly', monthlyReviewPeriod.start, monthlyReviewPeriod.end),
    staleTime: 60_000,
    enabled: electron.isReady,
  })

  // Check if there's actual content to review before showing review alerts
  const { data: hasReviewableContent } = useQuery({
    queryKey: ['reviewable-content-check-dashboard'],
    queryFn: async () => {
      try {
        // Check for any tasks
        const tasksCheck = await database.getTasks({ status: undefined })
        const activeTasks = tasksCheck.filter(t => !t.deleted_at)
        
        // Check for any goals
        const goalsCheck = await database.getGoals()
        const activeGoals = goalsCheck.filter(g => !g.deleted_at)
        
        // Check for any habits
        const habitsCheck = await database.getHabits()
        const activeHabits = habitsCheck.filter(h => !h.deleted_at)
        
        // Check for any notes
        const notes = await database.getNotes()
        const activeNotes = notes.filter(n => !n.deleted_at)
        
        // Check for any time blocks
        const todayStart = startOfDay(today).toISOString()
        const todayEnd = endOfDay(today).toISOString()
        const timeBlocks = await database.getTimeBlocks({ startDate: todayStart, endDate: todayEnd })
        
        // Return true if there's any meaningful data
        return activeTasks.length > 0 || 
               activeGoals.length > 0 || 
               activeHabits.length > 0 || 
               timeBlocks.length > 0 ||
               activeNotes.length > 0
      } catch (error) {
        console.error('Error checking reviewable content:', error)
        return false
      }
    },
    staleTime: 300000, // 5 minutes
    enabled: electron.isReady,
  })

  const habitCompletions = useMemo(
    () => (dashboardData as DashboardData | undefined)?.habitCompletions || [],
    [dashboardData]
  )

  const completedGoalsFromDashboard = useMemo(
    () => (dashboardData as DashboardData | undefined)?.completedGoals || [],
    [dashboardData]
  )

  const allHabitsForDashboard = useMemo(() => {
    return ((dashboardData as DashboardData | undefined)?.habits || habits).filter((habit) => !habit.deleted_at)
  }, [dashboardData, habits])

  const pendingHabitsForDashboardCard = useMemo(() => {
    const todayDate = new Date()
    const todayStart = startOfDay(todayDate)
    const todayEnd = endOfDay(todayDate)

    return allHabitsForDashboard.filter((habit) => {
      if (habit.frequency === 'daily') {
        const completedToday = habitCompletions.some((completion) =>
          completion.habit_id === habit.id &&
          completion.completed &&
          isDateInRange(safeParseISO(completion.date), todayStart, todayEnd)
        )
        return !completedToday
      }

      if (habit.frequency === 'weekly') {
        return !isWeeklyHabitCompletedThisWeekPersistent(habit.id, habitCompletions)
      }

      if (habit.frequency === 'monthly') {
        return !isMonthlyHabitCompletedThisMonthPersistent(habit.id, habitCompletions)
      }

      return false
    })
  }, [allHabitsForDashboard, habitCompletions])

  // TASK PROGRESS: Fetch from TODAY's section in TASK TAB
  const taskProgressStats = useMemo(() => {
    if (!statsSnapshot) {
      return {
        completed: 0,
        total: 0,
        completionRate: 0,
        weightedProgress: 0,
        totalWeight: 0,
        completedWeight: 0,
      }
    }

    // Use TODAY's stats from Task Tab snapshot
    return {
      completed: statsSnapshot.today.completed,
      total: statsSnapshot.today.total,
      completionRate: statsSnapshot.today.total > 0 
        ? Math.round((statsSnapshot.today.completed / statsSnapshot.today.total) * 100)
        : 0,
      weightedProgress: Math.round(statsSnapshot.today.weightedProgress),
      totalWeight: statsSnapshot.today.plannedWeight,
      completedWeight: statsSnapshot.today.earnedWeight,
    }
  }, [statsSnapshot])

  // DAILY OVERALL PROGRESS: Use TODAY's task stats + due-today habits only
  const dailyOverallProgress = useMemo(() => {
    const taskPlannedWeight = taskProgressStats.totalWeight
    const taskEarnedWeight = taskProgressStats.completedWeight

    const habitDueToday = calculateHabitDueMetricsForDay(allHabitsForDashboard, habitCompletions, today, 'short')
    const habitPlannedWeight = habitDueToday.dueHabits
    const habitEarnedWeight = habitDueToday.completedDueHabits
    const plannedWeight = taskPlannedWeight + habitPlannedWeight
    const earnedWeight = taskEarnedWeight + habitEarnedWeight

    return {
      plannedWeight,
      earnedWeight,
      progress: plannedWeight > 0 ? Math.round((earnedWeight / plannedWeight) * 100) : 0,
      tasks: {
        completed: taskProgressStats.completed,
        total: taskProgressStats.total,
      },
      habits: {
        completed: habitEarnedWeight,
        total: habitPlannedWeight,
      },
    }
  }, [taskProgressStats, allHabitsForDashboard, habitCompletions, today])

  // HABIT CONSISTENCY: Count only due habits for each day
  const habitConsistencyStats = useMemo(() => {
    const todayMetrics = calculateHabitDueMetricsForDay(allHabitsForDashboard, habitCompletions, today, 'short')

    const calculateDueHabitWindow = (start: Date, end: Date) => {
      const series = calculateHabitDueSeries(allHabitsForDashboard, habitCompletions, {
        start: startOfDay(start),
        end: endOfDay(end),
      }, 'short')

      const expected = series.reduce((sum, day) => sum + day.dueHabits, 0)
      const completed = series.reduce((sum, day) => sum + day.completedDueHabits, 0)
      const consistency = expected > 0 ? Math.round((completed / expected) * 100) : 0
      return { expected, completed, consistency }
    }

    const weekRange = { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfDay(today) }
    const monthRange = { start: startOfMonth(today), end: endOfDay(today) }
    const weekMetrics = calculateDueHabitWindow(weekRange.start, weekRange.end)
    const monthMetrics = calculateDueHabitWindow(monthRange.start, monthRange.end)

    return {
      todayConsistency: todayMetrics.consistency,
      weekConsistency: weekMetrics.consistency,
      monthConsistency: monthMetrics.consistency,
      completedToday: todayMetrics.completedDueHabits,
      expectedToday: todayMetrics.dueHabits,
      earlyCompletedToday: todayMetrics.earlyCompletedHabits,
      activeHabits: allHabitsForDashboard.length,
    }
  }, [allHabitsForDashboard, habitCompletions, today])

  // OVERALL PROGRESS (30 Days): Use Task Tab stats + Habit metrics for 30-day range
  const overallProgressScore = useMemo(() => {
    if (!statsSnapshot) {
      return {
        overall: 0,
        taskComponent: 0,
        habitComponent: 0,
        breakdown: {},
        completedTasks: 0,
        completedHabits: 0,
        totalTasks: 0,
        totalHabitPeriods: 0,
        totalPlannedWeight: 0,
        totalEarnedWeight: 0,
      }
    }

    // Use MONTH + PREVIOUS MONTH data from Task Tab to get ~30-day range
    const monthTaskStats = statsSnapshot.monthly
    const monthTaskWeight = monthTaskStats.plannedWeight
    const monthTaskEarned = monthTaskStats.earnedWeight

    // Get habit metrics for 30-day range
    const range = {
      start: startOfDay(subDays(today, 29)),
      end: endOfDay(today),
    }
    const habitMetrics = calculateHabitRangeMetrics(allHabitsForDashboard, habitCompletions, range)

    const totalPlannedWeight = monthTaskWeight + habitMetrics.expectedPeriods
    const totalEarnedWeight = monthTaskEarned + habitMetrics.completedPeriods
    const overall = totalPlannedWeight > 0
      ? Math.round((totalEarnedWeight / totalPlannedWeight) * 100)
      : 0

    return {
      overall,
      taskComponent: monthTaskStats.weightedProgress,
      habitComponent: habitMetrics.consistency,
      breakdown: {},
      completedTasks: monthTaskStats.completed,
      completedHabits: habitMetrics.completedPeriods,
      totalTasks: monthTaskStats.total,
      totalHabitPeriods: habitMetrics.expectedPeriods,
      totalPlannedWeight,
      totalEarnedWeight,
    }
  }, [statsSnapshot, allHabitsForDashboard, habitCompletions, today])

  // MONTH HEALTH: Use Task Tab monthly stats + habit consistency
  const monthHealthStats = useMemo(() => {
    if (!statsSnapshot) {
      return {
        plannedWeight: 0,
        earnedWeight: 0,
        progress: 0,
        habitConsistency: 0,
        daysRemaining: 0,
      }
    }

    const monthTaskStats = statsSnapshot.monthly
    // Use TASK weight only (don't add habit periods - they're different units)
    // This matches the Task Tab display exactly
    const plannedWeight = monthTaskStats.plannedWeight
    const earnedWeight = monthTaskStats.earnedWeight
    const monthProgress = monthTaskStats.weightedProgress
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

    return {
      plannedWeight,
      earnedWeight,
      progress: monthProgress,
      habitConsistency: habitConsistencyStats.monthConsistency,
      daysRemaining: Math.max(0, daysInMonth - today.getDate()),
    }
  }, [statsSnapshot, habitConsistencyStats.monthConsistency, today])

  const goalActivityStats = useMemo(() => {
    const monthRange = { start: startOfMonth(today), end: endOfDay(today) }
    const activeGoals = goals.filter((goal) => !goal.deleted_at && goal.status === 'active')
    const completedGoals = completedGoalsFromDashboard.filter((goal) => !goal.deleted_at && goal.status === 'completed')

    const goalsWithActivity = activeGoals.filter((goal) => {
      const taskActivity = tasks.some((task) => {
        if (task.deleted_at || task.goal_id !== goal.id || isTaskPausedOnDate(task, monthRange.end)) return false
        if (task.completed_at && isDateInRange(safeParseISO(task.completed_at), monthRange.start, monthRange.end)) {
          return true
        }
        if (task.daily_progress) {
          return Object.keys(task.daily_progress).some((dateKey) => {
            const day = safeParseISO(dateKey)
            const state = task.daily_progress?.[dateKey]
            return !!state && state.progress > 0 && isDateInRange(day, monthRange.start, monthRange.end)
          })
        }
        return false
      })

      const habitActivity = allHabitsForDashboard
        .filter((habit) => !habit.deleted_at && habit.goal_id === goal.id)
        .some((habit) => {
          const completionsForHabit = habitCompletions.filter((completion) => completion.completed && completion.habit_id === habit.id)
          return completionsForHabit.some((completion) => isDateInRange(safeParseISO(completion.date), monthRange.start, monthRange.end))
        })

      return taskActivity || habitActivity
    }).length

    const completedGoalsThisMonth = completedGoals.filter((goal) => {
      if (!goal.completed_at) return false
      const completedDate = safeParseISO(goal.completed_at)
      if (!completedDate) return false
      const completedKey = getLocalDateString(completedDate)
      return completedKey >= getLocalDateString(monthRange.start) && completedKey <= getLocalDateString(monthRange.end)
    }).length

    return {
      activeGoals: activeGoals.length,
      completedGoals: completedGoals.length,
      completedGoalsThisMonth,
      goalsWithActivity,
    }
  }, [goals, tasks, allHabitsForDashboard, habitCompletions, today, completedGoalsFromDashboard])

  const atRiskStats = useMemo(() => {
    const todayStart = startOfDay(today)
    const thirtyDayStart = startOfDay(subDays(today, 29))
    const todayKey = getLocalDateString(todayStart)
    const thirtyDayStartKey = getLocalDateString(thirtyDayStart)
    const overdueTasks = tasks.filter((task) => {
      if (task.deleted_at || isTaskPausedOnDate(task, todayStart) || !task.due_date) return false
      const dueKey = toDayKey(task.due_date)
      if (dueKey < thirtyDayStartKey || dueKey >= todayKey) return false
      return isTaskSkippedOrOverdueForDay(task, dueKey, todayKey)
    }).length

    const overdueGoals = goals.filter((goal) => {
      if (goal.deleted_at || goal.status === 'completed' || !goal.target_date) return false
      const targetDate = safeParseISO(goal.target_date)
      return !!targetDate && targetDate < todayStart
    }).length

    const habitAnalytics30d = calculateHabitAnalytics(
      allHabitsForDashboard,
      { start: thirtyDayStart, end: endOfDay(today) },
      habitCompletions
    )
    const overdueHabits = habitAnalytics30d.strugglingHabits.length

    return {
      overdueTasks,
      overdueHabits,
      overdueGoals,
      total: overdueTasks + overdueHabits + overdueGoals,
    }
  }, [tasks, goals, habitCompletions, allHabitsForDashboard, today])

  const reviewDayAlerts = useMemo(() => {
    // Don't show review alerts if there's no content to review
    if (!hasReviewableContent) {
      return []
    }

    const items: Array<{ type: 'weekly' | 'monthly'; title: string; message: string }> = []
    const isWeeklyDay = today.getDay() === 0
    const isMonthlyDay = today.getDate() === endOfMonth(today).getDate()

    if (isWeeklyDay && (!weeklyReviewDueCheck || weeklyReviewDueCheck.status !== 'completed')) {
      items.push({
        type: 'weekly',
        title: 'Weekly Review Due Today',
        message: 'Sunday review is ready. Capture wins, blockers, and priorities for next week.',
      })
    }

    if (isMonthlyDay && (!monthlyReviewDueCheck || monthlyReviewDueCheck.status !== 'completed')) {
      items.push({
        type: 'monthly',
        title: 'Monthly Review Due Today',
        message: 'It’s the last day of the month. Complete your monthly review to close the cycle clearly.',
      })
    }

    return items
  }, [today, weeklyReviewDueCheck, monthlyReviewDueCheck, hasReviewableContent])

  // Calculate goals with progress using centralized function
  const goalsWithProgress = useMemo(() => {
    return goals
      .filter(g => g.status === 'active' && !g.deleted_at)
      .map(goal => calculateGoalProgress(goal, tasks, habits))
      .sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        // Then by target date
        if (a.target_date && b.target_date) {
          return new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
        }
        return 0
      })
  }, [goals, tasks, habits])

  const quickInsightMetrics = useMemo(() => {
    const yesterdayStart = startOfDay(subDays(today, 1))
    const todayKey = getLocalDateString(today)
    const yesterdayKey = getLocalDateString(yesterdayStart)
    
    const yesterdayOverdueTasks = tasks.filter((task) => {
      if (task.deleted_at || isTaskPausedOnDate(task, yesterdayStart) || !task.due_date) return false
      const dueKey = toDayKey(task.due_date)
      if (dueKey !== yesterdayKey) return false
      return isTaskSkippedOrOverdueForDay(task, dueKey, todayKey)
    }).length

    const metrics = [
      {
        key: 'task-progress',
        title: 'Today Task Progress',
        value: `${taskProgressStats.weightedProgress}%`,
        subtitle: `${taskProgressStats.completed}/${taskProgressStats.total} completed`,
      },
      {
        key: 'habit-checkins',
        title: 'Habits Check-ins',
        value: `${dailyOverallProgress.habits.completed}/${dailyOverallProgress.habits.total}`,
        subtitle: `${habitConsistencyStats.todayConsistency}% daily consistency`,
      },
      {
        key: 'daily-indicator',
        title: 'Daily Indicator',
        value: `${dailyOverallProgress.progress}%`,
        subtitle: `${dailyOverallProgress.tasks.completed + dailyOverallProgress.habits.completed} checks completed today`,
      },
    ]

    // Only show overdue-tasks if there are actually overdue tasks
    if (yesterdayOverdueTasks > 0) {
      metrics.splice(1, 0, {
        key: 'overdue-tasks',
        title: 'Yesterday Overdue',
        value: `${yesterdayOverdueTasks}`,
        subtitle: 'Tasks missed yesterday',
      })
    }

    return metrics
  }, [
    taskProgressStats,
    tasks,
    today,
    dailyOverallProgress,
    habitConsistencyStats.todayConsistency,
  ])

  const selectedAnalyticsRange = useMemo(() => {
    const now = new Date()
    const weekOffset = analyticsWeekOffset * 7
    const end = subDays(now, -weekOffset)
    const start = subDays(end, 6)
    return { start, end }
  }, [analyticsWeekOffset])

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) {
      setGreeting('Good morning')
      setTimeOfDay('morning')
    } else if (hour < 18) {
      setGreeting('Good afternoon')
      setTimeOfDay('afternoon')
    } else {
      setGreeting('Good evening')
      setTimeOfDay('evening')
    }
  }, [])

  // Task progress mutation - updates Dashboard stats, Analytics, and Sidebar
  // CRITICAL: BINARY COMPLETION RULE - Only 100% progress = completed
  // No partial credit toward completion (tasks are either done or not)
  const updateTaskProgressMutation = useMutation({
    mutationFn: async ({ taskId, progress }: { taskId: string; progress: number }) => {
      // BINARY COMPLETION: only 100% = completed
      const isCompleted = progress === 100
      const status = isCompleted ? 'completed' : progress > 0 ? 'in-progress' : 'pending'
      const completed_at = isCompleted ? new Date().toISOString() : null
      
      await database.updateTask(taskId, { 
        progress, 
        status,
        ...(completed_at && { completed_at })
      })
      
      // Update the store directly for immediate UI update
      const taskToUpdate = tasks.find(t => t.id === taskId)
      if (taskToUpdate) {
        updateTask({
          ...taskToUpdate,
          progress,
          status: status as any,
          completed_at: completed_at || taskToUpdate.completed_at,
          updated_at: new Date().toISOString()
        })
      }
      
      return { taskId, progress, status }
    },
    onSuccess: (data) => {
      // Invalidate all related queries for consistency
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] }) // Goals linked to tasks
      // Task is completed only when progress is 100%
      if (data.progress === 100) {
        toastSuccess('Task completed!')
      }
    },
    onError: () => {
      toastError('Failed to update task progress')
    }
  })

  // Handle task progress change from TaskList component
  const handleProgressChange = useCallback((taskId: string, progress: number) => {
    updateTaskProgressMutation.mutate({ taskId, progress })
  }, [updateTaskProgressMutation])

  // Create task mutation - Same as Tasks page
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskDTO & { duration_type?: TaskDurationType }) => {
      const newTaskId = await database.createTask(taskData)
      const newTask = await database.getTaskById(newTaskId)
      return newTask
    },
    onSuccess: (newTask) => {
      if (newTask) {
        addTask(newTask)
        toastSuccess('Task created successfully! 🎉')
        setIsTaskDialogOpen(false)
        setTaskFormData(getInitialFormData())
        // Invalidate queries for consistency
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      }
    },
    onError: () => toastError('Failed to create task'),
  })

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return updatedTask
    },
    onSuccess: (updatedTask) => {
      if (updatedTask) {
        updateTask(updatedTask)
        toastSuccess('Task updated!')
        setIsTaskDialogOpen(false)
        setIsEditing(null)
        setTaskFormData(getInitialFormData())
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      }
    },
    onError: () => toastError('Failed to update task'),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await database.archiveTask(id)
      return id
    },
    onSuccess: (id) => {
      archiveTask(id)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      toastSuccess('Task archived')
      setTaskToArchive(null)
    },
    onError: () => toastError('Failed to archive task'),
  })

  // Handle task creation
  const handleSaveTask = useCallback(() => {
    if (!taskFormData.title.trim()) {
      toastError('Please enter a task title')
      return
    }

    const taskData: any = {
      title: taskFormData.title,
      description: taskFormData.description || undefined,
      priority: taskFormData.priority,
      due_date: taskFormData.due_date || undefined,
      estimated_time: taskFormData.estimated_time ? parseInt(taskFormData.estimated_time, 10) : undefined,
      goal_id: taskFormData.goal_id || undefined,
      tags: taskFormData.tags.length > 0 ? taskFormData.tags : undefined,
      duration_type: taskFormData.duration_type,
    }

    if (isEditing) {
      updateTaskMutation.mutate({ id: isEditing, updates: taskData })
    } else {
      createTaskMutation.mutate(taskData)
    }
  }, [taskFormData, isEditing, createTaskMutation, updateTaskMutation, toastError])

  const handleEditTask = (task: Task) => {
    setIsEditing(task.id)
    setTaskFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') : '',
      priority: task.priority,
      estimated_time: task.estimated_time?.toString() || '',
      goal_id: task.goal_id || '',
      duration_type: task.duration_type || 'today',
      tags: task.tags || [],
    })
    setIsTaskDialogOpen(true)
  }

  // Tag management
  const addTag = useCallback(() => {
    if (newTag.trim() && !taskFormData.tags.includes(newTag.trim())) {
      setTaskFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }))
      setNewTag('')
    }
  }, [newTag, taskFormData.tags])

  const removeTag = useCallback((tagToRemove: string) => {
    setTaskFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }))
  }, [])

  // Process chart data using centralized calculation for consistency
  // Supports viewing previous weeks with analyticsWeekOffset
  const chartData = useMemo(() => {
    const { start, end } = selectedAnalyticsRange
    const completions = (dashboardData as DashboardData | undefined)?.habitCompletions || []
    const completedGoals = (dashboardData as DashboardData | undefined)?.completedGoals || []
    const data = calculateTrendData(tasks, allHabitsForDashboard, completions, { start, end }, 'short')
    return data.map((d: any) => ({
      ...d,
      completedHabits: d.completedHabits ?? d.habitsCompleted ?? 0,
      goalsCompleted: completedGoals.filter((goal) => {
        if (goal.deleted_at || !goal.completed_at) return false
        const completedDate = safeParseISO(goal.completed_at)
        return !!completedDate && getLocalDateString(completedDate) === d.fullDate
      }).length,
    }))
  }, [tasks, allHabitsForDashboard, dashboardData, selectedAnalyticsRange])

  const habitChartData = useMemo(
    () => chartData.map((point) => ({
      date: point.date,
      fullDate: point.fullDate,
      habits: point.habits,
      completedHabits: point.habitsCompleted,
    })),
    [chartData]
  )

  // Calculate productivity score for the selected chart period to match Analytics tab
  const periodProductivityScore = useMemo(() => {
    const range = selectedAnalyticsRange
    
    const tAnalytics = calculateTaskAnalytics(tasks, range)
    const hAnalytics = calculateHabitAnalytics(allHabitsForDashboard, range, habitCompletions)
    
    return calculateProductivityScore(tAnalytics, hAnalytics)
  }, [tasks, allHabitsForDashboard, selectedAnalyticsRange, habitCompletions])

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load dashboard</h3>
              <p className="text-muted-foreground mb-4">
                There was an error loading your dashboard data.
              </p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}!</h1>
          <p className="text-muted-foreground">
            {format(today, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <QuickActions />
        </div>
      </div>

      {/* Review Reminder Banner */}
      <ReviewBanner />

      {/* Weekly/Monthly Review Day Alerts */}
      {reviewDayAlerts.length > 0 && (
        <div className="space-y-2">
          {reviewDayAlerts.map((alert) => (
            <div
              key={alert.type}
              className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 to-violet-500/10 border border-primary/20"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate(`/reviews?type=${alert.type}`)}>
                Open Review
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dashboard Stats */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-sky-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                Overall Progress (30 Days)
              </CardTitle>
              <CardDescription>Tasks + habits weighted by real completions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-sky-600">{overallProgressScore.overall}%</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Tasks: {overallProgressScore.completedTasks}/{overallProgressScore.totalTasks} • Habit periods: {overallProgressScore.completedHabits}/{overallProgressScore.totalHabitPeriods}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-violet-600" />
                Task Progress
              </CardTitle>
              <CardDescription>Today from Task Tab</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion Rate</span>
                <span className="font-semibold text-violet-600">{taskProgressStats.completionRate}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Weighted Progress</span>
                <span className="font-semibold text-violet-600">{taskProgressStats.weightedProgress}%</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Completed {taskProgressStats.completed}/{taskProgressStats.total} tasks
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flame className="h-4 w-4 text-emerald-600" />
                Daily Overall Progress
              </CardTitle>
              <CardDescription>Daily habits completed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{dailyOverallProgress.progress}%</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Tasks {dailyOverallProgress.tasks.completed}/{dailyOverallProgress.tasks.total} • Habits {dailyOverallProgress.habits.completed}/{dailyOverallProgress.habits.total}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                Month Health
              </CardTitle>
              <CardDescription>Tasks and habits for current month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{monthHealthStats.progress}%</div>
              <div className="text-xs text-muted-foreground mt-2">
                Weight {Math.round(monthHealthStats.earnedWeight)}/{Math.round(monthHealthStats.plannedWeight)} • Habit consistency {monthHealthStats.habitConsistency}%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-600" />
                Habit Consistency
              </CardTitle>
              <CardDescription>Completed due habits only</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{habitConsistencyStats.todayConsistency}%</div>
              <div className="text-xs text-muted-foreground mt-2">
                Today {habitConsistencyStats.completedToday}/{habitConsistencyStats.expectedToday} due • Week {habitConsistencyStats.weekConsistency}% • Month {habitConsistencyStats.monthConsistency}%
              </div>
              {habitConsistencyStats.earlyCompletedToday > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">Completed Early ✓ {habitConsistencyStats.earlyCompletedToday}</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                Goal Activity
              </CardTitle>
              <CardDescription>Active, activity, and completed goals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{goalActivityStats.goalsWithActivity}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Active {goalActivityStats.activeGoals} • Completed {goalActivityStats.completedGoals} ({goalActivityStats.completedGoalsThisMonth} this month)
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/40 bg-gradient-to-br from-red-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                At-Risk Items
              </CardTitle>
              <CardDescription>Overdue tasks, habits, and goals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{atRiskStats.total}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Tasks {atRiskStats.overdueTasks} • Habits {atRiskStats.overdueHabits} • Goals {atRiskStats.overdueGoals}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* All Tasks - Shows ALL tasks including completed ones */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <ListTodo className="h-5 w-5" />
                  <span>Today's Tasks</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="dark:bg-zinc-800 dark:text-zinc-100">
                    {allTodaysTasks.filter(t => (t.progress || 0) === 100).length}/{allTodaysTasks.length} done
                  </Badge>
                  <Button 
                    size="sm" 
                    onClick={() => setIsTaskDialogOpen(true)}
                    className="h-8"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Task
                  </Button>
                </div>
              </div>
              <CardDescription>
                Today's tasks from Tasks tab • Completed tasks stay visible
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allTodaysTasks.length > 0 ? (
                <TaskList 
                  tasks={allTodaysTasks} 
                  showPriority={true}
                  showActions={true}
                  compact={false}
                  onProgressChange={handleProgressChange}
                  onEdit={handleEditTask}
                  onArchive={setTaskToArchive}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks scheduled for today.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => setIsTaskDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Analytics - Real Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Progress Analytics</span>
                  </CardTitle>
                  <CardDescription>
                    Weekly performance overview
                  </CardDescription>
                  {/* Week selector - Left/Right arrows with date in middle */}
                  <div className="flex items-center justify-between w-full mt-3 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnalyticsWeekOffset(analyticsWeekOffset - 1)}
                      className="h-7 px-2"
                    >
                      ←
                    </Button>
                    <div className="text-sm text-muted-foreground text-center flex-1">
                      {(() => {
                        const today = new Date()
                        const weekOffset = analyticsWeekOffset * 7
                        const end = subDays(today, -weekOffset)
                        const start = subDays(end, 6)
                        return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
                      })()}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnalyticsWeekOffset(analyticsWeekOffset + 1)}
                      disabled={analyticsWeekOffset === 0}
                      className="h-7 px-2"
                    >
                      →
                    </Button>
                  </div>
                </div>
                {/* Chart type selector - stays in top right */}
                <Tabs value={chartTab} onValueChange={(v) => setChartTab(v as any)} className="w-auto">
                  <TabsList className="h-8 bg-secondary/30 dark:bg-secondary/20 p-1 border-transparent">
                    <TabsTrigger value="productivity" className="px-3 text-xs">Productivity</TabsTrigger>
                    <TabsTrigger value="tasks" className="px-3 text-xs">Tasks</TabsTrigger>
                    <TabsTrigger value="habits" className="px-3 text-xs">Habits</TabsTrigger>
                    <TabsTrigger value="goals" className="px-3 text-xs">Goals</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stats Summary */}
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Productivity Score</div>
                  <div className="text-lg font-bold mt-1">
                    {periodProductivityScore.overall}%
                  </div>
                </div>
                
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Tasks</div>
                  <div className="text-lg font-bold mt-1">
                    {chartData.reduce((sum, d) => sum + d.tasks, 0)}
                  </div>
                </div>
                
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Completed Due Habits</div>
                  <div className="text-lg font-bold mt-1">
                    {habitChartData.reduce((sum, d) => sum + d.completedHabits, 0)}
                  </div>
                 
                </div>

                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Goals</div>
                  <div className="text-lg font-bold mt-1">
                    {chartData.reduce((sum, d) => sum + d.goalsCompleted, 0)}
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="h-64">
                {chartData.length === 0 && (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No activity data yet</p>
                      <p className="text-xs">Complete tasks and habits to see your progress</p>
                    </div>
                  </div>
                )}
                {chartData.length > 0 && chartTab === 'tasks' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="tasks" name="Total Tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="hsl(var(--status-completed))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {chartData.length > 0 && chartTab === 'habits' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={habitChartData}>
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 'dataMax + 1']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="habits"
                        name="Due Habits"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="completedHabits"
                        name="Completed Due"
                        stroke="#22c55e"
                        strokeWidth={3}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {chartData.length > 0 && chartTab === 'productivity' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="productivityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                      <YAxis yAxisId="goals" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="productivity"
                        name="Productivity Score"
                        stroke="hsl(var(--primary))"
                        fill="url(#productivityGradient)"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="goals"
                        type="monotone"
                        dataKey="goalsCompleted"
                        name="Goal Completions"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {chartData.length > 0 && chartTab === 'goals' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="goalsCompleted" name="Goal Completions" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Habits - Shows ONLY INCOMPLETE daily, weekly, and monthly habits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Flame className="h-5 w-5" />
                <span>Habits</span>
              </CardTitle>
              <CardDescription>
                {pendingHabitsForDashboardCard.length > 0
                  ? `${pendingHabitsForDashboardCard.length} pending habit${pendingHabitsForDashboardCard.length !== 1 ? 's' : ''}`
                  : 'All habits completed'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingHabitsForDashboardCard.length > 0 ? (
                <HabitTracker 
                  habits={pendingHabitsForDashboardCard}
                  habitCompletions={habitCompletions}
                  compact={true}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending habits remaining. Keep up the great work!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Goals - Enhanced representation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Active Goals</span>
              </CardTitle>
              <CardDescription>
                Focus areas and momentum
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalsWithProgress.length > 0 ? (
                goalsWithProgress.slice(0, 3).map((goal) => {
                  // Calculate momentum and status
                  const daysRemaining = goal.target_date 
                    ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null
                  const isOnTrack = goal.calculatedProgress >= 50 || (daysRemaining !== null && daysRemaining > 14)
                  const isUrgent = daysRemaining !== null && daysRemaining <= 7 && goal.calculatedProgress < 80
                  const momentum = goal.linkedTasksCount > 0 
                    ? goal.completedTasksCount > 0 ? 'Active' : 'Stalled'
                    : 'No tasks linked'
                  
                  return (
                    <div 
                      key={goal.id} 
                      onClick={() => navigate('/goals')}
                      className={cn(
                      "p-3 rounded-lg border transition-colors cursor-pointer",
                      isUrgent && "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
                      !isUrgent && isOnTrack && "border-green-500/20 bg-green-500/5 hover:bg-green-500/10",
                      !isUrgent && !isOnTrack && "bg-muted/30 hover:bg-muted/50"
                    )}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{goal.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={goal.category as any} size="sm" className="text-[10px]">
                              {goal.category}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              size="sm"
                              className={cn(
                                "text-[10px]",
                                momentum === 'Active' && "text-green-600 border-green-500/30",
                                momentum === 'Stalled' && "text-amber-600 border-amber-500/30"
                              )}
                            >
                              {momentum}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {daysRemaining !== null && (
                            <p className={cn(
                              "text-[10px]",
                              daysRemaining <= 0 && "text-destructive",
                              daysRemaining > 0 && daysRemaining <= 7 && "text-amber-600",
                              daysRemaining > 7 && "text-muted-foreground"
                            )}>
                              {daysRemaining <= 0 ? 'Overdue!' : `${daysRemaining}d left`}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Stats row */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span>{goal.completedTasksCount}/{goal.linkedTasksCount} tasks</span>
                        {goal.linkedHabitsCount > 0 && (
                          <span>{goal.avgHabitConsistency}% habit consistency</span>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active goals. Set some goals to get started!</p>
                </div>
              )}
              {goalsWithProgress.length > 3 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10"
                  onClick={() => navigate('/goals')}
                >
                  View all goals ({goalsWithProgress.length})
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Review Reminder Widget */}
          <ReviewReminder showAll={false} />

          {/* Quick Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5" />
                <span>Quick Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickInsightMetrics.map((metric) => (
                <div key={metric.key} className="p-3 rounded-lg border bg-primary/5 border-primary/15">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{metric.title}</span>
                    <span className="text-sm font-semibold text-primary">{metric.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Achievements */}
          {((dashboardData as DashboardData | undefined)?.achievements?.length || 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-base">
                  <Award className="h-4 w-4" />
                  <span>Recent Achievements</span>
                </CardTitle>
                <CardDescription>
                  Celebrate your recent successes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(dashboardData as DashboardData).achievements.map((achievement: Achievement, index: number) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      achievement.type === 'goal_completed'
                        ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                        : "bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center shadow-sm",
                        achievement.type === 'goal_completed'
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      )}>
                        {achievement.type === 'goal_completed' ? (
                          <Target className="h-4 w-4" />
                        ) : (
                          <Flame className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{achievement.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(achievement.timestamp), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Message */}
      <div className="text-center text-sm text-muted-foreground">
        Have a productive {timeOfDay}! Remember to take breaks and stay hydrated.
      </div>

      {/* Add Task Dialog - Same form as Tasks page */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl bg-card max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update task details.' : 'Add a new task for today. Set priority and duration.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-4 py-4">
              {/* Task Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Task Title *</label>
                <Input
                  placeholder="What needs to be done?"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                />
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Add details or notes..."
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                />
              </div>
              
              {/* Priority & Duration Type - 3 PRIORITIES ONLY */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={taskFormData.priority}
                    onValueChange={(value: Priority) => setTaskFormData(prev => ({ ...prev, priority: value }))}
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
                    value={taskFormData.duration_type}
                    onValueChange={(value: TaskDurationType) => {
                      // Clear due_date when switching to "today" type
                      if (value === 'today') {
                        setTaskFormData(prev => ({ ...prev, duration_type: value, due_date: '' }))
                      } else {
                        setTaskFormData(prev => ({ ...prev, duration_type: value }))
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
              
              {/* Due Date & Estimated Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", taskFormData.duration_type === 'today' && "text-muted-foreground")}>Due Date</label>
                  <Input
                    type="date"
                    disabled={taskFormData.duration_type === 'today'}
                    value={taskFormData.due_date}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, due_date: e.target.value }))}
                    className={cn("bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15", taskFormData.duration_type === 'today' && "opacity-50 cursor-not-allowed")}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimated Time (min)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 30"
                    value={taskFormData.estimated_time}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, estimated_time: e.target.value }))}
                    className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                  />
                </div>
              </div>
              
              {/* Related Goal */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Related Goal</label>
                <Select
                  value={taskFormData.goal_id || "none"}
                  onValueChange={(value) => setTaskFormData(prev => ({ ...prev, goal_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                    <SelectValue placeholder="Select a goal..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Goal</SelectItem>
                    {goals?.filter(g => g.status === 'active').map((goal) => (
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
                  <Button type="button" onClick={addTag} variant="secondary" size="sm">
                    Add
                  </Button>
                </div>
                {taskFormData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {taskFormData.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
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
            <Button 
              variant="outline" 
              onClick={() => {
                setIsTaskDialogOpen(false)
                setTaskFormData(getInitialFormData())
                setNewTag('')
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTask}
              disabled={createTaskMutation.isPending || updateTaskMutation.isPending || !taskFormData.title.trim()}
            >
              {createTaskMutation.isPending || updateTaskMutation.isPending ? 'Saving...' : (isEditing ? 'Update Task' : 'Create Task')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!taskToArchive} onOpenChange={(open) => !open && setTaskToArchive(null)}>
        
        <AlertDialogContent className="bg-white text-black border border-border shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Task</AlertDialogTitle>
            <AlertDialogDescription>
              This task will be moved to the Archive. You can restore it later from the Archive section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => taskToArchive && deleteTaskMutation.mutate(taskToArchive)}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
