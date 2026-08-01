
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shallow } from 'zustand/shallow'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Target, 
  AlertCircle,
  CalendarDays,
  ArrowUpRight,
  Flame,
  Award,
  AlertTriangle,
  Calendar,
  BarChart3,
  Plus,
  BookOpen,
  X,
} from 'lucide-react'
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { useTauri } from '@/hooks/use-tauri'
import { useToaster } from '@/hooks/use-toaster'
import { useStore } from '@/store'
import { HabitTracker } from '@/components/habit-tracker'
import { TaskList } from '@/components/task-list'
import { QuickActions } from '@/components/quick-actions'
import { ReviewBanner } from '@/components/review-reminder'
import { cn } from '@/lib/utils'
import { Task, Goal, Habit, HabitCompletion, TaskDurationType, Priority } from '@/types'
import { database, CreateTaskDTO, getLocalDateString, TaskTabStatsSnapshot } from '@/lib/database'
import { buildTaskProgressUpdatePayload, invalidateTaskRelatedQueries } from '@/lib/task-sync'
import {
  calculateHabitAnalytics,
  calculateHabitDueMetricsForDay,
  calculateHabitDueSeries,
  calculateTrendData,
  calculateGoalProgress,
  getDateRange
} from '@/lib/progress'
import { getTodaysTasks, isTaskPausedOnDate } from '@/lib/daily-reset'
import { 
  isWeeklyHabitCompletedThisWeekPersistent,
  isMonthlyHabitCompletedThisMonthPersistent
} from '@/lib/habit-logic'
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

export default function Dashboard() {
  const navigate = useNavigate()
  const tauri = useTauri()
  const queryClient = useQueryClient()
  const { error: toastError, success: toastSuccess } = useToaster()
  const { tasks, habits, goals, updateTask, addTask, archiveTask, deleteTask } = useStore(
    (state) => ({
      tasks: state.tasks,
      habits: state.habits,
      goals: state.goals,
      updateTask: state.updateTask,
      addTask: state.addTask,
      archiveTask: state.archiveTask,
      deleteTask: state.deleteTask,
    }),
    shallow
  )
  const today = new Date()
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

    // Sort: incomplete first (by priority), then completed at bottom
    return todaysTasksList.sort((a, b) => {
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

        let goalsResult;
        try {
          goalsResult = await database.executeQuery<any>(`
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
        } catch (e: any) { throw new Error('goalsResult query failed: ' + e.message); }

        let completedGoalsResult;
        try {
          completedGoalsResult = await database.executeQuery<any>(`
            SELECT * FROM goals
            WHERE status = 'completed'
            AND completed_at IS NOT NULL
            AND deleted_at IS NULL
            ORDER BY completed_at DESC
          `)
        } catch (e: any) { throw new Error('completedGoalsResult query failed: ' + e.message); }

        let rawHabits;
        try {
          rawHabits = await database.executeQuery<any>(`
            SELECT h.*, 
                   (SELECT completed FROM habit_completions 
                    WHERE habit_id = h.id AND date = ?) as today_completed
            FROM habits h
            WHERE h.deleted_at IS NULL
            AND h.frequency IN ('daily', 'weekly', 'monthly')
            ORDER BY h.consistency_score DESC
          `, [todayStr])
        } catch (e: any) { throw new Error('rawHabits query failed: ' + e.message); }

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

        let habitCompletions;
        try {
          habitCompletions = await database.getHabitCompletions(earliestHabitDate, todayStr)
        } catch (e: any) { throw new Error('getHabitCompletions failed: ' + e.message); }

        let achievements;
        try {
          achievements = await database.executeQuery<any>(`
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
        } catch (e: any) { throw new Error('achievements query failed: ' + e.message); }

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
    enabled: tauri.isReady,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000, // 30 seconds - more frequent updates
  })

  // Fetch TaskTabStats - same as Task Tab uses for consistent data
  const { data: statsSnapshot } = useQuery<TaskTabStatsSnapshot>({
    queryKey: ['task-stats', todayStr],
    queryFn: () => database.getTaskTabStats(),
    staleTime: 30 * 1000,
    enabled: tauri.isReady,
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
    enabled: tauri.isReady,
  })

  const { data: monthlyReviewDueCheck } = useQuery({
    queryKey: ['review-check', 'monthly-dashboard-alert', monthlyReviewPeriod.start, monthlyReviewPeriod.end],
    queryFn: () => database.getReviewForPeriod('monthly', monthlyReviewPeriod.start, monthlyReviewPeriod.end),
    staleTime: 60_000,
    enabled: tauri.isReady,
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
    enabled: tauri.isReady,
  })

  const habitCompletions = useMemo(
    () => (dashboardData as DashboardData | undefined)?.habitCompletions || [],
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

  // OVERALL PROGRESS (Month): removed from KPI cards

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

  // GOAL ACTIVITY: removed from KPI cards

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



  // Always use current calendar week (Mon-Sun ending today) to match Analytics tab
  const selectedAnalyticsRange = useMemo(() => getDateRange('week'), [])

  const estimatedTimeRemaining = useMemo(() => {
    const uncompletedTasks = allTodaysTasks.filter(t => (t.progress || 0) < 100)
    const minutes = uncompletedTasks.reduce((sum, t) => sum + (t.estimated_time || 0), 0)
    if (minutes === 0) return '0h'
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`
  }, [allTodaysTasks])

  // Set greeting based on time of day and workload
  useEffect(() => {
    const hour = new Date().getHours()
    let timeGreeting = ''
    if (hour < 12) {
      timeGreeting = 'Good morning'
    } else if (hour < 18) {
      timeGreeting = 'Good afternoon'
    } else {
      timeGreeting = 'Good evening'
    }

    const importantTasksLeft = allTodaysTasks.filter(t => (t.progress || 0) < 100 && t.priority === 'high').length
    const habitsLeft = pendingHabitsForDashboardCard.length

    if (importantTasksLeft > 0) {
      setGreeting(`${timeGreeting}. You have ${importantTasksLeft} important ${importantTasksLeft === 1 ? 'task' : 'tasks'} today.`)
    } else if (habitsLeft > 0 && habitsLeft <= 2) {
      setGreeting(`${timeGreeting}. Only ${habitsLeft} ${habitsLeft === 1 ? 'habit' : 'habits'} left. You're almost done!`)
    } else {
      setGreeting(`${timeGreeting}. Welcome to your workspace.`)
    }
  }, [allTodaysTasks, pendingHabitsForDashboardCard.length])

  // Task progress mutation - updates Dashboard stats, Analytics, and Sidebar
  // CRITICAL: BINARY COMPLETION RULE - Only 100% progress = completed
  // No partial credit toward completion (tasks are either done or not)
  const invalidateTaskDerivedQueries = useCallback(() => {
    invalidateTaskRelatedQueries(queryClient)
  }, [queryClient])

  const updateTaskProgressMutation = useMutation({
    onMutate: async ({ taskId, progress }) => {
      const previousTask = tasks.find((t: any) => t.id === taskId)
      if (previousTask) {
        updateTask({ ...previousTask, progress } as any)
      }
      return { previousTask }
    },
    mutationFn: async ({ taskId, progress }: { taskId: string; progress: number }) => {
      const existingTask = await database.getTaskById(taskId)
      if (!existingTask) throw new Error('Task not found')

      const { updates } = buildTaskProgressUpdatePayload(existingTask, progress)
      await database.updateTask(taskId, updates)
      const updatedTask = await database.getTaskById(taskId)

      return { updatedTask, progress }
    },
    onSuccess: ({ updatedTask, progress }) => {
      if (updatedTask) {
        updateTask(updatedTask as any)
      }

      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      invalidateTaskDerivedQueries()

      // Task is completed only when progress is 100%
      if (progress === 100) {
        toastSuccess('Task completed!')
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previousTask) {
        updateTask(context.previousTask as any)
      }
      if (error instanceof Error && error.message.includes('paused')) {
        toastError('Task is paused. Resume it to continue progress tracking.')
        return
      }
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
        addTask(newTask as any)
        toastSuccess('Task created successfully! 🎉')
        setIsTaskDialogOpen(false)
        setTaskFormData(getInitialFormData())
        invalidateTaskDerivedQueries()
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
        updateTask(updatedTask as any)
        toastSuccess('Task updated!')
        setIsTaskDialogOpen(false)
        setIsEditing(null)
        setTaskFormData(getInitialFormData())
        queryClient.invalidateQueries({ queryKey: ['review-insights'] })
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to update task'),
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
      await database.archiveTask(id)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      invalidateTaskDerivedQueries()
      toastSuccess('Task archived')
      setTaskToArchive(null)
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
    mutationFn: async (id: string) => {
      // Completely remove task and all associated data (checklist items, time blocks, notes, etc.)
      await database.permanentlyDeleteTask(id, { deleteHistory: true })
      return id
    },
    onSuccess: (id) => {
      deleteTask(id)
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      invalidateTaskDerivedQueries()
      toastSuccess('Task permanently deleted. All data removed.')
      setTaskToArchive(null)
    },
    onError: () => toastError('Failed to permanently delete task'),
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
  // Chart data for current week to match Analytics tab
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




  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load dashboard</h3>
              <p className="text-muted-foreground">There was an error loading your dashboard data: {error instanceof Error ? error.message : String(error)}</p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 relative">
      {/* Header with Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 bg-background/80 backdrop-blur-md p-4 -mx-6 -mt-6 mb-2 border-b border-border/40 shadow-sm rounded-b-xl transition-all">
        <div className="pl-2">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">{greeting}</h1>
          <p className="text-muted-foreground mt-1">
            {format(today, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-2 pr-2">
          <QuickActions />
        </div>
      </div>

      {/* Today's Summary */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tasks Left</span>
            <span className="text-2xl font-bold text-foreground mt-1">{allTodaysTasks.filter(t => (t.progress || 0) < 100).length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Habits Left</span>
            <span className="text-2xl font-bold text-foreground mt-1">{pendingHabitsForDashboardCard.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Est. Time</span>
            <span className="text-2xl font-bold text-foreground mt-1">{estimatedTimeRemaining}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Reviews Due</span>
            <span className="text-2xl font-bold text-foreground mt-1">{reviewDayAlerts.length}</span>
          </div>
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
              className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 to-violet-500/10 border border-primary/20 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-primary">{alert.title}</p>
                  <p className="text-sm text-primary/80">{alert.message}</p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate(`/reviews?type=${alert.type}`)} className="shadow-sm">
                Open Review
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics (Capped at 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/80 backdrop-blur-sm bg-gradient-to-br from-emerald-500/5 to-transparent border-border/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-600" />
              Today's Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{dailyOverallProgress.progress}%</div>
            <div className="mt-2 text-xs text-muted-foreground font-medium">
              Tasks {dailyOverallProgress.tasks.completed}/{dailyOverallProgress.tasks.total} • Habits {dailyOverallProgress.habits.completed}/{dailyOverallProgress.habits.total}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm bg-gradient-to-br from-sky-500/5 to-transparent border-border/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-sky-600" />
              Month Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-sky-600">{monthHealthStats.progress}%</div>
            <div className="mt-2 text-xs text-muted-foreground font-medium">
              {monthHealthStats.daysRemaining} days remaining in month
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm bg-gradient-to-br from-blue-500/5 to-transparent border-border/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-600" />
              Consistency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{habitConsistencyStats.weekConsistency}%</div>
            <div className="mt-2 text-xs text-muted-foreground font-medium">
              Weekly habit completion rate
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{atRiskStats.total}</div>
            <div className="mt-2 text-xs text-red-600/80 font-medium">
              Tasks {atRiskStats.overdueTasks} • Habits {atRiskStats.overdueHabits} • Goals {atRiskStats.overdueGoals}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Focus - Only important/today tasks */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Today's Focus</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setIsTaskDialogOpen(true)} className="h-8 shadow-sm hover:shadow-md transition-all">
                    <Plus className="mr-1 h-4 w-4" />
                    New Focus
                  </Button>
                </div>
              </div>
              <CardDescription>
                High priority tasks and today's commitments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allTodaysTasks.filter(t => t.priority === 'high' || (t.duration_type === 'today' && t.status !== 'completed')).length > 0 ? (
                <TaskList 
                  tasks={allTodaysTasks.filter(t => t.priority === 'high' || t.duration_type === 'today')} 
                  showPriority={true}
                  showActions={true}
                  compact={false}
                  onProgressChange={handleProgressChange}
                  onEdit={handleEditTask}
                  onArchive={setTaskToArchive}
                />
              ) : (
                <div className="text-center py-10 px-4 text-muted-foreground bg-gradient-to-b from-muted/30 to-muted/10 rounded-xl border border-dashed border-border/60">
                  <div className="bg-background/50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <CheckCircle className="h-8 w-8 opacity-60 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">You're all caught up!</p>
                  <p className="text-xs mt-1.5 opacity-80">No high priority tasks remaining for today. Enjoy your time or add a new focus.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Weekly Progress Sparkline */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-sky-500" />
                  <span>Weekly Progress</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between h-24 mt-2 gap-1">
                  {chartData.map((d: any, i: number) => (
                    <div key={i} className="flex flex-col items-center flex-1 group relative">
                      <div className="w-full relative flex items-end justify-center h-20 rounded-t-sm bg-muted/30 overflow-hidden">
                        <div 
                          className="w-full bg-primary/60 group-hover:bg-primary transition-all duration-300 rounded-t-sm" 
                          style={{ height: `${d.productivity || 5}%` }}
                        />
                      </div>
                      <div className="absolute opacity-0 group-hover:opacity-100 -top-10 bg-popover border border-border text-xs px-2 py-1 rounded shadow-md pointer-events-none transition-opacity whitespace-nowrap z-10">
                        {d.productivity}%
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{d.date.substring(0, 3)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Achievements */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span>Recent Achievements</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mt-2">
                  {(dashboardData as DashboardData | undefined)?.achievements.length ? (
                    (dashboardData as DashboardData | undefined)?.achievements.slice(0, 3).map((achievement: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          {achievement.type === 'streak_achieved' ? <Flame className="h-4 w-4 text-amber-500" /> : <Target className="h-4 w-4 text-amber-500" />}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{achievement.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(achievement.timestamp), 'MMM d, h:mm a')}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 px-4 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
                      <Award className="h-6 w-6 mx-auto mb-2 opacity-30 text-amber-500" />
                      <p className="text-xs font-medium">No recent achievements.</p>
                      <p className="text-[10px] mt-0.5 opacity-80">Keep pushing to unlock milestones!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Timeline */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                <CalendarDays className="h-4 w-4 text-violet-500" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-2">
                {/* Find recently completed tasks from today */}
                {(() => {
                   const recentTasks = tasks.filter(t => t.progress === 100 && t.completed_at && isDateInRange(parseISO(t.completed_at), startOfDay(today), endOfDay(today))).slice(0, 3);
                   const recentHabits = habitCompletions.filter(h => h.completed && isDateInRange(parseISO(h.created_at), startOfDay(today), endOfDay(today))).slice(0, 3);
                   
                   const combined = [...recentTasks.map(t => ({ title: `Completed task: ${t.title}`, time: parseISO(t.completed_at!), type: 'task' })),
                                     ...recentHabits.map(h => {
                                        const habitName = allHabitsForDashboard.find(ah => ah.id === h.habit_id)?.title || 'Habit';
                                        return { title: `Checked in: ${habitName}`, time: parseISO(h.created_at), type: 'habit' }
                                     })].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 4);

                   if (combined.length === 0) {
                     return (
                       <div className="text-center py-6 px-4 text-muted-foreground bg-gradient-to-b from-muted/30 to-muted/10 rounded-xl border border-dashed border-border/60">
                         <CalendarDays className="h-6 w-6 mx-auto mb-2 opacity-30 text-violet-500" />
                         <p className="text-xs font-medium">No activity today yet.</p>
                         <p className="text-[10px] mt-0.5 opacity-80">Check off a task or habit to get started!</p>
                       </div>
                     )
                   }

                   return combined.map((item, i) => (
                     <div key={i} className="flex items-start gap-3 relative">
                       {i !== combined.length - 1 && <div className="absolute top-6 left-2 w-px h-full bg-border -z-10" />}
                       <div className={`mt-0.5 h-4 w-4 rounded-full flex-shrink-0 flex items-center justify-center ${item.type === 'task' ? 'bg-violet-500/20 text-violet-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                         <CheckCircle className="h-3 w-3" />
                       </div>
                       <div>
                         <p className="text-sm font-medium leading-none">{item.title}</p>
                         <p className="text-xs text-muted-foreground mt-1">{format(item.time, 'h:mm a')}</p>
                       </div>
                     </div>
                   ))
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Pending Habits - Streamlined */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-sm font-semibold">
                <Flame className="h-4 w-4 text-indigo-500" />
                <span>Pending Habits</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingHabitsForDashboardCard.length > 0 ? (
                <div className="space-y-1 relative z-10">
                  <HabitTracker 
                    habits={pendingHabitsForDashboardCard}
                    habitCompletions={habitCompletions}
                    compact={true}
                  />
                </div>
              ) : (
                <div className="text-center py-8 px-4 text-muted-foreground bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 rounded-xl border border-dashed border-emerald-500/20">
                  <div className="bg-emerald-500/10 h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <CheckCircle className="h-7 w-7 text-emerald-500 opacity-80" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">All habits completed!</p>
                  <p className="text-xs mt-1 text-emerald-600/70 dark:text-emerald-400/70">You're crushing it today.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goal Momentum */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span>Goal Momentum</span>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold">Active</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalsWithProgress.length > 0 ? (
                goalsWithProgress.slice(0, 3).map((goal) => {
                  return (
                    <div 
                      key={goal.id} 
                      className="group relative overflow-hidden rounded-lg border border-border/50 bg-muted/10 p-3 hover:bg-muted/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" 
                      onClick={() => navigate(`/goals/${goal.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/goals/${goal.id}`)
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm leading-none">{goal.title}</h4>
                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{goal.calculatedProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 transition-all duration-500" 
                          style={{ width: `${goal.calculatedProgress}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8 px-4 text-muted-foreground bg-gradient-to-b from-purple-500/5 to-transparent rounded-xl border border-dashed border-purple-500/20">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-30 text-purple-500" />
                  <p className="text-sm font-medium text-foreground">No active goals</p>
                  <p className="text-xs mt-1 opacity-80">Start tracking a goal to see momentum.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analytics Shortcut */}
          <Card 
            className="bg-gradient-to-br from-blue-600 to-indigo-700 text-primary-foreground border-transparent shadow-md hover:shadow-lg transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500" 
            onClick={() => navigate('/analytics')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/analytics')
              }
            }}
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-white/80" />
                  Deep Dive
                </h3>
                <p className="text-white/70 text-sm">Explore your full analytics and historical trends.</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Message */}
      <div className="text-center text-sm text-muted-foreground">
        Have a productive day! Remember to take breaks and stay hydrated.
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
                        <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive" aria-label={`Remove tag ${tag}`}>
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
            <AlertDialogTitle>
              {(() => {
                const task = tasks.find(t => t.id === taskToArchive)
                return task?.duration_type === 'today' ? 'Archive or Delete Task?' : 'Archive Task'
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {(() => {
                const task = tasks.find(t => t.id === taskToArchive)
                return (
                  <>
                    <p>
                      {task?.duration_type === 'today' 
                        ? `Choose how to handle "${task?.title}":`
                        : 'This task will be moved to the Archive. You can restore it later from the Archive section.'
                      }
                    </p>
                    {task?.duration_type === 'today' && (
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
                  </>
                )
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={(() => {
            const task = tasks.find(t => t.id === taskToArchive)
            return task?.duration_type === 'today' ? 'flex-col sm:flex-row gap-2' : ''
          })()}>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => taskToArchive && deleteTaskMutation.mutate(taskToArchive)}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Archive
            </AlertDialogAction>
            {(() => {
              const task = tasks.find(t => t.id === taskToArchive)
              return task?.duration_type === 'today' && (
                <AlertDialogAction
                  onClick={() => taskToArchive && permanentDeleteTaskMutation.mutate(taskToArchive)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Permanent Delete
                </AlertDialogAction>
              )
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}







