import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle, 
  TrendingUp, 
  Target, 
  AlertCircle,
  Zap,
  CalendarDays,
  ArrowUpRight,
  Flame,
  Award,
  Trophy,
  Lightbulb,
  Activity,
  AlertTriangle,
  Calendar,
  BarChart3,
  ListTodo,
} from 'lucide-react'
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, eachDayOfInterval } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { useStore } from '@/store'
import { HabitTracker } from '@/components/habit-tracker'
import { TaskList } from '@/components/task-list'
import { PomodoroTimer } from '@/components/pomodoro-timer'
import { QuickActions } from '@/components/quick-actions'
import { ReviewBanner, ReviewReminder } from '@/components/review-reminder'
import { cn } from '@/lib/utils'
import { Task, Goal, Habit } from '@/types'
import { database } from '@/lib/database'
import { 
  calculateDashboardSummary,
  calculateGoalProgress,
  calculateHabitAnalytics,
  calculateTaskAnalytics,
  calculateProductivityScore,
  getDateRange
} from '@/lib/progress'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

// Types
type TimeRange = 'day' | 'week' | 'month' | 'year'

interface DashboardStats {
  completed_today: number;
  completed_week: number;
  completed_month: number;
  completed_year: number;
  avg_goal_progress: number;
  avg_consistency: number;
  overdue_tasks: number;
  total_tasks_today: number;
  total_tasks_week: number;
  total_tasks_month: number;
  total_tasks_year: number;
  // Activity streaks calculated from habit_completions and task completions
  activity_streak: number;
  longest_activity_streak: number;
}

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
  habits: HabitWithCompletion[];
  stats: DashboardStats;
  achievements: Achievement[];
  weeklyActivity: any[];
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

export default function Dashboard() {
  const electron = useElectron()
  const queryClient = useQueryClient()
  const { error: toastError, success: toastSuccess } = useToaster()
  const { tasks, habits, goals, updateTask } = useStore()
  const today = new Date()
  
  const [timeRange, setTimeRange] = useState<TimeRange>('day')
  const [chartTab, setChartTab] = useState<'tasks' | 'habits' | 'productivity'>('tasks')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [greeting, setGreeting] = useState('')

  // Calculate dashboard summary using centralized utilities
  const dashboardSummary = useMemo(() => {
    return calculateDashboardSummary(tasks, habits, goals, [])
  }, [tasks, habits, goals])

  // Get ALL today's tasks (including completed) for Dashboard display
  // Completed tasks should remain visible with different styling
  const allTodaysTasks = useMemo(() => {
    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())
    
    return tasks
      .filter(t => {
        if (t.deleted_at) return false
        if (!t.due_date) return false
        try {
          const dueDate = parseISO(t.due_date)
          return dueDate >= todayStart && dueDate <= todayEnd
        } catch {
          return false
        }
      })
      .sort((a, b) => {
        // Completed tasks go to the bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        // Then sort by priority
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
      })
  }, [tasks])

  // ============================================
  // STAT 1: TASK PROGRESS (Weighted by Priority)
  // Uses PRIORITY_WEIGHTS from progress.ts
  // ============================================
  const taskProgressStats = useMemo(() => {
    const dateRange = getDateRange(timeRange as any)
    const taskAnalytics = calculateTaskAnalytics(tasks, dateRange)
    
    return {
      completed: taskAnalytics.completed,
      total: taskAnalytics.total,
      simpleProgress: taskAnalytics.simpleCompletionRate,
      weightedProgress: taskAnalytics.weightedCompletionRate,
      totalWeight: taskAnalytics.totalWeight,
      completedWeight: taskAnalytics.completedWeight
    }
  }, [tasks, timeRange])

  // ============================================
  // STAT 2: HABIT CONSISTENCY
  // From habit completion history (persisted in DB)
  // ============================================
  const habitConsistencyStats = useMemo(() => {
    const habitAnalytics = calculateHabitAnalytics(habits)
    return {
      avgConsistency: habitAnalytics.avgConsistency,
      totalCurrentStreak: habitAnalytics.totalCurrentStreak,
      totalLongestStreak: habitAnalytics.totalLongestStreak,
      activeHabits: habitAnalytics.total
    }
  }, [habits])

  // ============================================
  // STAT 3: ACTIVITY STREAKS
  // Consecutive days with at least one completed task OR habit
  // Single source of truth: calculated from REAL completion data only
  // ============================================
  const activityStreakStats = useMemo(() => {
    // Get the last 365 days for proper streak calculation
    const last365Days = eachDayOfInterval({
      start: subDays(new Date(), 365),
      end: new Date()
    })
    
    // Get the last 30 days for active days count
    const last30DaysInterval = eachDayOfInterval({
      start: subDays(new Date(), 30),
      end: new Date()
    })
    
    // Get all dates with completed tasks (from REAL completion data)
    const taskCompletionDates = new Set(
      tasks
        .filter(t => !t.deleted_at && t.status === 'completed' && t.completed_at)
        .map(t => {
          try {
            return format(parseISO(t.completed_at!), 'yyyy-MM-dd')
          } catch {
            return null
          }
        })
        .filter(Boolean) as string[]
    )
    
    // Get dates with habit completions (habits with current streak indicate today's activity)
    // Also check if any habit has been completed today based on streak_current > 0
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const hasHabitActivityToday = habits.some(h => !h.deleted_at && h.streak_current > 0)
    
    // Build a set of all active dates (tasks + habits)
    const activeDates = new Set(taskCompletionDates)
    if (hasHabitActivityToday) {
      activeDates.add(todayStr)
    }
    
    // Calculate current activity streak (consecutive days from today backwards)
    let currentStreak = 0
    let cursor = new Date()
    
    // Check if there's activity today or yesterday to start the streak
    const cursorStr = format(cursor, 'yyyy-MM-dd')
    if (activeDates.has(cursorStr)) {
      currentStreak = 1
      cursor = subDays(cursor, 1)
      
      // Count consecutive days backwards
      for (let i = 0; i < 365; i++) {
        const dateStr = format(cursor, 'yyyy-MM-dd')
        if (activeDates.has(dateStr)) {
          currentStreak++
          cursor = subDays(cursor, 1)
        } else {
          break
        }
      }
    } else {
      // No activity today, check if yesterday had activity
      cursor = subDays(cursor, 1)
      const yesterdayStr = format(cursor, 'yyyy-MM-dd')
      if (activeDates.has(yesterdayStr)) {
        currentStreak = 1
        cursor = subDays(cursor, 1)
        
        // Count consecutive days backwards from yesterday
        for (let i = 0; i < 365; i++) {
          const dateStr = format(cursor, 'yyyy-MM-dd')
          if (activeDates.has(dateStr)) {
            currentStreak++
            cursor = subDays(cursor, 1)
          } else {
            break
          }
        }
      }
    }
    
    // Calculate longest streak from ALL historical data
    let longestStreak = currentStreak
    let tempStreak = 0
    
    // Go through all days and find the longest consecutive streak
    for (let i = last365Days.length - 1; i >= 0; i--) {
      const dayStr = format(last365Days[i], 'yyyy-MM-dd')
      if (activeDates.has(dayStr)) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }
    
    // Also consider habit longest streaks from database
    const habitLongestStreak = habits.reduce((max, h) => 
      Math.max(max, h.streak_longest || 0), 0
    )
    longestStreak = Math.max(longestStreak, habitLongestStreak)
    
    // Count days with activity in the last 30 days
    const daysActiveIn30Days = last30DaysInterval.filter(day => {
      const dayStr = format(day, 'yyyy-MM-dd')
      return activeDates.has(dayStr)
    }).length
    
    return {
      currentStreak,
      longestStreak,
      daysActive: daysActiveIn30Days
    }
  }, [tasks, habits])

  // ============================================
  // STAT 4: OVERALL PROGRESS SCORE
  // Uses Analytics formula: 60% Tasks + 40% Habits
  // Single source of truth from progress.ts
  // ============================================
  const overallProgressScore = useMemo(() => {
    const taskAnalytics = calculateTaskAnalytics(tasks)
    const habitAnalytics = calculateHabitAnalytics(habits)
    const productivityScore = calculateProductivityScore(taskAnalytics, habitAnalytics)
    
    return {
      overall: productivityScore.overall,
      taskComponent: productivityScore.taskComponent,
      habitComponent: productivityScore.habitComponent,
      breakdown: productivityScore.breakdown
    }
  }, [tasks, habits])

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

  // Fetch dashboard data from database with real habits completion status
  const { data: dashboardData, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      try {
        // Fetch today's tasks directly from database
        const tasksResult = await electron.executeQuery<Task[]>(`
          SELECT * FROM tasks 
          WHERE due_date BETWEEN ? AND ?
          AND status != 'completed'
          AND deleted_at IS NULL
          ORDER BY 
            CASE priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            due_date ASC
          LIMIT 10
        `, [startOfDay(today).toISOString(), endOfDay(today).toISOString()])

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

        // IMPORTANT: Fetch today's habits with their completion status from habit_completions table
        // This ensures checked habits persist after page refresh
        const rawHabits = await electron.executeQuery<any[]>(`
          SELECT h.*, 
                 (SELECT completed FROM habit_completions 
                  WHERE habit_id = h.id AND date = ?) as today_completed
          FROM habits h
          WHERE h.deleted_at IS NULL
          AND (
            h.frequency = 'daily' OR
            (h.frequency = 'weekly' AND ? IN (SELECT value FROM json_each(h.schedule)))
          )
          ORDER BY h.consistency_score DESC
        `, [format(today, 'yyyy-MM-dd'), format(today, 'EEEE').toLowerCase()])

        const habitsResult = (Array.isArray(rawHabits) ? rawHabits : []).map((h: any) => ({
          ...h,
          today_completed: !!h.today_completed,
          schedule: typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
        }))

        // Fetch comprehensive statistics
        const stats = await electron.executeQuery<DashboardStats[]>(`
          SELECT 
            -- Today's completed
            (SELECT COUNT(*) FROM tasks 
             WHERE status = 'completed' 
             AND completed_at BETWEEN ? AND ?) as completed_today,
            
            -- Today's total
            (SELECT COUNT(*) FROM tasks 
             WHERE due_date BETWEEN ? AND ?
             AND deleted_at IS NULL) as total_tasks_today,
            
            -- Week's completed
            (SELECT COUNT(*) FROM tasks 
             WHERE status = 'completed' 
             AND completed_at BETWEEN ? AND ?) as completed_week,
            
            -- Week's total
            (SELECT COUNT(*) FROM tasks 
             WHERE due_date BETWEEN ? AND ?
             AND deleted_at IS NULL) as total_tasks_week,
            
            -- Month's completed
            (SELECT COUNT(*) FROM tasks 
             WHERE status = 'completed' 
             AND completed_at BETWEEN ? AND ?) as completed_month,
            
            -- Month's total
            (SELECT COUNT(*) FROM tasks 
             WHERE due_date BETWEEN ? AND ?
             AND deleted_at IS NULL) as total_tasks_month,
            
            -- Year's completed
            (SELECT COUNT(*) FROM tasks 
             WHERE status = 'completed' 
             AND completed_at BETWEEN ? AND ?) as completed_year,
            
            -- Year's total
            (SELECT COUNT(*) FROM tasks 
             WHERE due_date BETWEEN ? AND ?
             AND deleted_at IS NULL) as total_tasks_year,
            
            -- Goal progress
            (SELECT AVG(progress) FROM goals 
             WHERE status = 'active') as avg_goal_progress,
            
            -- Habit consistency
            (SELECT AVG(consistency_score) FROM habits 
             WHERE deleted_at IS NULL) as avg_consistency,
            
            -- Overdue tasks
            (SELECT COUNT(*) FROM tasks 
             WHERE due_date < ? 
             AND status != 'completed'
             AND deleted_at IS NULL) as overdue_tasks
        `, [
          startOfDay(today).toISOString(), endOfDay(today).toISOString(),
          startOfDay(today).toISOString(), endOfDay(today).toISOString(),
          startOfWeek(today, { weekStartsOn: 1 }).toISOString(), endOfWeek(today, { weekStartsOn: 1 }).toISOString(),
          startOfWeek(today, { weekStartsOn: 1 }).toISOString(), endOfWeek(today, { weekStartsOn: 1 }).toISOString(),
          startOfMonth(today).toISOString(), endOfMonth(today).toISOString(),
          startOfMonth(today).toISOString(), endOfMonth(today).toISOString(),
          startOfYear(today).toISOString(), endOfYear(today).toISOString(),
          startOfYear(today).toISOString(), endOfYear(today).toISOString(),
          startOfDay(today).toISOString()
        ])

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

        // Fetch weekly activity for chart
        const weeklyActivity = await electron.executeQuery(`
          WITH RECURSIVE dates(date) AS (
            VALUES(?)
            UNION ALL
            SELECT date(date, '+1 day')
            FROM dates
            WHERE date < ?
          )
          SELECT 
            d.date,
            (SELECT COUNT(*) FROM tasks WHERE date(due_date) = d.date AND deleted_at IS NULL) as total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE date(completed_at) = d.date AND status = 'completed' AND deleted_at IS NULL) as completed_tasks,
            (SELECT COUNT(*) FROM habit_completions WHERE date = d.date AND completed = 1) as completed_habits,
            (SELECT COUNT(DISTINCT habit_id) FROM habit_completions WHERE date = d.date) as total_habit_entries
          FROM dates d
        `, [format(subDays(today, 6), 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')])

        return { 
          tasks: Array.isArray(tasksResult) ? tasksResult : [], 
          goals: Array.isArray(goalsResult) ? goalsResult : [], 
          habits: habitsResult, 
          stats: Array.isArray(stats) ? stats[0] || {} : {}, 
          achievements: Array.isArray(achievements) ? achievements : [],
          weeklyActivity: Array.isArray(weeklyActivity) ? weeklyActivity : []
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

  // Task progress mutation - updates Dashboard stats, Analytics, and Sidebar
  const updateTaskProgressMutation = useMutation({
    mutationFn: async ({ taskId, progress }: { taskId: string; progress: number }) => {
      const status = progress === 100 ? 'completed' : 'in-progress'
      const completed_at = progress === 100 ? new Date().toISOString() : null
      
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
      queryClient.invalidateQueries({ queryKey: ['goals'] }) // Goals linked to tasks
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

  // Chart data point type
  interface ChartDataPoint {
    date: string
    fullDate: string
    tasks: number
    completed: number
    habits: number
    completedHabits: number
    productivity: number
  }

  // Process chart data using real weekly activity from database
  const chartData: ChartDataPoint[] = useMemo(() => {
    const weeklyActivity = (dashboardData as DashboardData | undefined)?.weeklyActivity
    if (!weeklyActivity) return []
    
    return weeklyActivity.map((day: any) => {
      const date = new Date(day.date)
      const dayName = format(date, 'EEE')
      const totalTasks = day.total_tasks || 0
      const completedTasks = day.completed_tasks || 0
      const completedHabits = day.completed_habits || 0
      const totalHabits = habits.filter(h => !h.deleted_at).length
      
      // Calculate productivity using SAME formula as Analytics (60% tasks + 40% habits)
      const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      const habitProgress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0
      const productivity = Math.round(taskProgress * 0.6 + habitProgress * 0.4)

      return {
        date: dayName,
        fullDate: day.date,
        tasks: totalTasks,
        completed: completedTasks,
        habits: totalHabits,
        completedHabits: completedHabits,
        productivity: productivity
      }
    })
  }, [dashboardData, habits])

  // Generate insights
  const insights = useMemo(() => {
    const result: Array<{ type: 'success' | 'warning' | 'info'; icon: any; title: string; message: string }> = []
    const data = dashboardData as DashboardData | undefined
    const stats = data?.stats || {} as DashboardStats
    
    // Overdue tasks warning
    if ((stats.overdue_tasks || 0) > 0) {
      result.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Overdue Tasks',
        message: `You have ${stats.overdue_tasks} overdue task${stats.overdue_tasks > 1 ? 's' : ''} that need attention.`
      })
    }
    
    // High consistency
    if ((stats.avg_consistency || 0) >= 80) {
      result.push({
        type: 'success',
        icon: TrendingUp,
        title: 'High Consistency',
        message: `Your habit consistency is ${Math.round(stats.avg_consistency)}%. Keep up the great work!`
      })
    }
    
    // Today's progress
    if ((stats.completed_today || 0) > 0) {
      result.push({
        type: 'info',
        icon: Zap,
        title: 'Momentum',
        message: `You've completed ${stats.completed_today} task${stats.completed_today > 1 ? 's' : ''} today. Stay focused!`
      })
    }
    
    // Weekly streak
    if ((stats.completed_week || 0) >= 10) {
      result.push({
        type: 'success',
        icon: Trophy,
        title: 'Productive Week',
        message: `You've completed ${stats.completed_week} tasks this week. Excellent progress!`
      })
    }
    
    // Goal progress
    if ((stats.avg_goal_progress || 0) >= 50) {
      result.push({
        type: 'info',
        icon: Target,
        title: 'Goals On Track',
        message: `Your goals are ${Math.round(stats.avg_goal_progress)}% complete on average.`
      })
    }
    
    // All caught up message
    if ((stats.overdue_tasks || 0) === 0 && result.length === 0) {
      result.push({
        type: 'success',
        icon: CheckCircle,
        title: 'All Caught Up',
        message: 'You have no overdue tasks. Great job staying on top of things!'
      })
    }
    
    return result.slice(0, 3) // Limit to 3 insights
  }, [dashboardData?.stats])

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
          <PomodoroTimer />
          <QuickActions />
        </div>
      </div>

      {/* Review Reminder Banner */}
      <ReviewBanner />

      {/* Time Range Filter for Task Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Task Progress Period</span>
            </div>
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="w-auto">
              <TabsList className="grid grid-cols-4 h-9">
                <TabsTrigger value="day" className="px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Today</TabsTrigger>
                <TabsTrigger value="week" className="px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Week</TabsTrigger>
                <TabsTrigger value="month" className="px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Month</TabsTrigger>
                <TabsTrigger value="year" className="px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid - EXACTLY 4 Stats (No More, No Less) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* STAT 1: Task Progress (Weighted by Priority) - Responds to time range */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-status-completed" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taskProgressStats.weightedProgress}%
            </div>
            <p className="text-xs text-muted-foreground">
              {taskProgressStats.completed} of {taskProgressStats.total} tasks • weighted by priority
            </p>
            <Progress 
              value={taskProgressStats.weightedProgress} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Weight: {taskProgressStats.completedWeight}/{taskProgressStats.totalWeight}
            </p>
          </CardContent>
        </Card>
        
        {/* STAT 2: Habit Consistency (From Completion History) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Habit Consistency</CardTitle>
            <TrendingUp className="h-4 w-4 text-category-health" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {habitConsistencyStats.avgConsistency}%
            </div>
            <p className="text-xs text-muted-foreground">
              {habitConsistencyStats.totalCurrentStreak} streak days • {habitConsistencyStats.activeHabits} active habits
            </p>
            <Progress 
              value={habitConsistencyStats.avgConsistency} 
              variant="success"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Best: {habitConsistencyStats.totalLongestStreak} days
            </p>
          </CardContent>
        </Card>
        
        {/* STAT 3: Activity Streaks (Consecutive Days with Activity) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Streaks</CardTitle>
            <Flame className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {activityStreakStats.currentStreak}
              <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground">
              consecutive days with task/habit activity
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Trophy className="h-3 w-3 text-amber-500" />
              <span className="text-xs">Longest: {activityStreakStats.longestStreak} days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activityStreakStats.daysActive} active days (30d)
            </p>
          </CardContent>
        </Card>
        
        {/* STAT 4: Overall Progress Score (60% Tasks + 40% Habits) */}
        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {overallProgressScore.overall}%
            </div>
            <p className="text-xs text-muted-foreground">
              60% tasks + 40% habits formula
            </p>
            <Progress 
              value={overallProgressScore.overall} 
              className="mt-2"
            />
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-blue-500" />
                <span>Tasks: {overallProgressScore.breakdown.weightedTaskCompletion}%</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span>Habits: {overallProgressScore.breakdown.habitConsistency}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Tasks - Shows ALL tasks including completed ones */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <ListTodo className="h-5 w-5" />
                  <span>Today's Tasks</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {allTodaysTasks.filter(t => t.status === 'completed').length}/{allTodaysTasks.length} done
                  </Badge>
                  {dashboardSummary.overdueTasks > 0 && (
                    <Badge variant="destructive">
                      {dashboardSummary.overdueTasks} overdue
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>
                Your tasks for {format(today, 'MMMM d')} • Completed tasks stay visible
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allTodaysTasks.length > 0 ? (
                <TaskList 
                  tasks={allTodaysTasks.slice(0, 8)} 
                  showPriority={true}
                  showActions={true}
                  compact={false}
                  onProgressChange={handleProgressChange}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks scheduled for today.</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Zap className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Analytics - Real Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Progress Analytics</span>
                  </CardTitle>
                  <CardDescription>
                    Weekly performance overview
                  </CardDescription>
                </div>
                <Tabs value={chartTab} onValueChange={(v) => setChartTab(v as any)} className="w-auto">
                  <TabsList className="h-8">
                    <TabsTrigger value="tasks" className="px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Tasks</TabsTrigger>
                    <TabsTrigger value="habits" className="px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Habits</TabsTrigger>
                    <TabsTrigger value="productivity" className="px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Productivity</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stats Summary */}
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Task Completion</div>
                  <div className="text-lg font-bold mt-1">
                    {chartData.length > 0 
                      ? Math.round(chartData.reduce((sum, d) => sum + (d.tasks > 0 ? (d.completed / d.tasks) * 100 : 0), 0) / chartData.length)
                      : 0}%
                  </div>
                </div>
                
                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Avg. Productivity</div>
                  <div className="text-lg font-bold mt-1">
                    {chartData.length > 0 
                      ? Math.round(chartData.reduce((sum, d) => sum + d.productivity, 0) / chartData.length)
                      : 0}%
                  </div>
                </div>
                
                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Weekly Tasks</div>
                  <div className="text-lg font-bold mt-1">
                    {chartData.reduce((sum, d) => sum + d.completed, 0)}
                  </div>
                </div>
                
                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Habit Entries</div>
                  <div className="text-lg font-bold mt-1">
                    {chartData.reduce((sum, d) => sum + d.completedHabits, 0)}
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="tasks" name="Total Tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="hsl(var(--status-completed))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {chartData.length > 0 && chartTab === 'habits' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="habits"
                        name="Total Habits"
                        stroke="hsl(var(--category-health))"
                        fill="hsl(var(--category-health))"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="completedHabits"
                        name="Completed"
                        stroke="hsl(var(--category-learning))"
                        fill="hsl(var(--category-learning))"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
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
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Achievements */}
          {((dashboardData as DashboardData | undefined)?.achievements?.length || 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="h-5 w-5" />
                  <span>Recent Achievements</span>
                </CardTitle>
                <CardDescription>
                  Celebrate your recent successes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(dashboardData as DashboardData).achievements.map((achievement: Achievement, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center",
                          achievement.type === 'goal_completed' 
                            ? "bg-status-completed/10 text-status-completed"
                            : "bg-category-learning/10 text-category-learning"
                        )}>
                          {achievement.type === 'goal_completed' ? (
                            <Target className="h-5 w-5" />
                          ) : (
                            <Flame className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{achievement.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(achievement.timestamp), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Today's Habits - Using data from database query (fixes persistence) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Flame className="h-5 w-5" />
                <span>Today's Habits</span>
              </CardTitle>
              <CardDescription>
                Build consistency day by day
              </CardDescription>
            </CardHeader>
            <CardContent>
              {((dashboardData as DashboardData | undefined)?.habits?.length || 0) > 0 ? (
                <HabitTracker 
                  habits={(dashboardData as DashboardData).habits}
                  compact={true}
                />
              ) : dashboardSummary.todaysHabits.length > 0 ? (
                <HabitTracker 
                  habits={dashboardSummary.todaysHabits}
                  compact={true}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No habits scheduled for today.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Active Goals</span>
              </CardTitle>
              <CardDescription>
                Your current focus areas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goalsWithProgress.length > 0 ? (
                goalsWithProgress.slice(0, 3).map((goal) => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{goal.title}</span>
                      <span className="text-sm font-bold">{goal.calculatedProgress}%</span>
                    </div>
                    <Progress value={goal.calculatedProgress} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Badge variant={goal.category as any} size="sm">
                        {goal.category}
                      </Badge>
                      <span>
                        {goal.target_date ? 
                          `${format(new Date(goal.target_date), 'MMM d')}` : 
                          'No date'
                        }
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active goals. Set some goals to get started!</p>
                </div>
              )}
              {goalsWithProgress.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10">
                  View all goals ({goalsWithProgress.length})
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Review Reminder Widget */}
          <ReviewReminder showAll={false} />

          {/* Summary Stats - Uses same data sources as the 4 main stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Summary</span>
              </CardTitle>
              <CardDescription>
                Quick overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tasks Completed</span>
                  <span className="font-semibold">{taskProgressStats.completed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Weighted Progress</span>
                  <span className="font-semibold">{taskProgressStats.weightedProgress}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Habits</span>
                  <span className="font-semibold">{habitConsistencyStats.activeHabits}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Activity Streak</span>
                  <span className="font-semibold">{activityStreakStats.currentStreak} days</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Overall Score</span>
                  <span className="font-bold text-primary">
                    {overallProgressScore.overall}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5" />
                <span>Quick Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.map((insight, index) => (
                <div 
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border",
                    insight.type === 'success' && "bg-green-500/10 border-green-500/20",
                    insight.type === 'warning' && "bg-destructive/10 border-destructive/20",
                    insight.type === 'info' && "bg-primary/5 border-primary/10"
                  )}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <insight.icon className={cn(
                      "h-4 w-4",
                      insight.type === 'success' && "text-green-500",
                      insight.type === 'warning' && "text-destructive",
                      insight.type === 'info' && "text-primary"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      insight.type === 'success' && "text-green-600",
                      insight.type === 'warning' && "text-destructive",
                      insight.type === 'info' && "text-foreground"
                    )}>
                      {insight.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {insight.message}
                  </p>
                </div>
              ))}
              
              {insights.length === 0 && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center space-x-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">All Good</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Keep up the great work! You're on track.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Message */}
      <div className="text-center text-sm text-muted-foreground">
        Have a productive {timeOfDay}! Remember to take breaks and stay hydrated.
      </div>
    </div>
  )
}
