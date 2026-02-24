import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Target,
  Filter,
  CheckCircle,
  Clock,
  Zap,
  Award,
  Activity,
  ListTodo,
  Repeat,
  Timer
} from 'lucide-react'
import { format, parseISO, startOfWeek, startOfMonth, addMonths } from 'date-fns'
import { useStore } from '@/store'
import { useElectron } from '@/hooks/use-electron'
import { useSharedTimer } from '@/hooks/use-shared-timer'
import { database } from '@/lib/database'
import { ContextTipsDialog } from '@/components/context-tips-dialog'
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
  PieChart as RechartsPie,
  Pie,
  Cell
} from 'recharts'
import {
  calculateHabitAnalytics,
  calculateHabitDueMetricsForDay,
  calculateHabitDueSeries,
  getDateRange,
  calculateGoalAnalytics,
  calculateTimeAnalytics,
  calculateProductivityScore,
  type TimeRange,
  type GoalWithProgress
} from '@/lib/progress'
import type { HabitCompletion } from '@/types'
import type { TaskRangeAnalyticsSnapshot, TaskTabStatsSnapshot } from '@/lib/database'

// Color palette for charts
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const PRODUCTIVE_TIME_FILTER_SQL = `
          AND (
            notes IS NULL
            OR (
              notes NOT LIKE 'shortBreak session%'
              AND notes NOT LIKE 'longBreak session%'
            )
          )
`

const ANALYTICS_TIPS_SECTIONS = [
  {
    title: 'How to Read Analytics',
    points: [
      'Use time ranges to compare behavior patterns, not just one-day outcomes.',
      'Weighted task progress shows impact quality, while simple completion shows quantity.',
      'Habit consistency highlights reliability over time rather than isolated wins.',
    ],
  },
  {
    title: 'Interpretation Best Practices',
    points: [
      'Look for repeat trends across weeks before changing your system.',
      'Use dips as diagnostics (scope, energy, schedule) instead of self-judgment.',
      'Compare task, habit, and time metrics together to find true bottlenecks.',
    ],
  },
  {
    title: 'Actionable Follow-Through',
    points: [
      'Turn weak metrics into one concrete adjustment for the next cycle.',
      'Review overdue and skipped signals early to avoid compounding backlog.',
      'Re-check after one week to confirm whether the adjustment actually helped.',
    ],
  },
] as const

// Custom Tooltip component for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-popover p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center">
              <div 
                className="mr-2 h-2.5 w-2.5 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
            </div>
            <span className="font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Analytics() {
  const { tasks, habits, goals } = useStore()
  const { timerMode, timerRunning, elapsedMs } = useSharedTimer()
  const electron = useElectron()
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  const isProductiveTimerMode = timerMode === 'pomodoro' || timerMode === 'custom'
  
  // Strict rolling windows from today
  const dateRange = useMemo(() => getDateRange(timeRange), [timeRange])
  const taskDateRange = dateRange
  const habitDateRange = dateRange
  
  const goalAnalytics = useMemo(() => 
    calculateGoalAnalytics(goals, tasks, habits, dateRange), 
    [goals, tasks, habits, dateRange]
  )
  
  const timeAnalytics = useMemo(() => 
    calculateTimeAnalytics(tasks, dateRange), 
    [tasks, dateRange]
  )

  // Fetch complete habit completion history once, then apply range logic in shared analytics
  const { data: allHabitCompletions = [] } = useQuery<HabitCompletion[]>({
    queryKey: ['habit-completions-all'],
    queryFn: async () => {
      if (!electron.isReady) return []
      const earliestHabitDate = habits.length > 0
        ? habits
            .map((habit) => format(parseISO(habit.created_at), 'yyyy-MM-dd'))
            .sort()[0]
        : format(new Date(), 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')
      return await database.getHabitCompletions(earliestHabitDate, today)
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 30000,
  })

  const habitAnalytics = useMemo(() =>
    calculateHabitAnalytics(habits, habitDateRange, allHabitCompletions),
    [allHabitCompletions, habitDateRange, habits]
  )

  const { data: taskTabStatsSnapshot } = useQuery<TaskTabStatsSnapshot>({
    queryKey: ['task-stats', 'analytics-day-sync'],
    queryFn: () => database.getTaskTabStats(),
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const { data: taskRangeSnapshotData } = useQuery<TaskRangeAnalyticsSnapshot>({
    queryKey: ['task-range-snapshot', format(taskDateRange.start, 'yyyy-MM-dd'), format(taskDateRange.end, 'yyyy-MM-dd')],
    queryFn: () => database.getTaskRangeAnalyticsSnapshot(
      format(taskDateRange.start, 'yyyy-MM-dd'),
      format(taskDateRange.end, 'yyyy-MM-dd')
    ),
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 30000,
  })

  const taskRangeSnapshot = useMemo<TaskRangeAnalyticsSnapshot>(() => {
    return taskRangeSnapshotData ?? {
      startDate: format(taskDateRange.start, 'yyyy-MM-dd'),
      endDate: format(taskDateRange.end, 'yyyy-MM-dd'),
      summary: {
        total: 0,
        completed: 0,
        partially: 0,
        skipped: 0,
        plannedWeight: 0,
        earnedWeight: 0,
        weightedProgress: 0,
      },
      overdue: 0,
      byPriority: {
        high: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
        medium: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
        low: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
      },
      daily: [],
    }
  }, [taskDateRange.end, taskDateRange.start, taskRangeSnapshotData])

  const taskAnalytics = useMemo(() => {
    const isDayRange = timeRange === 'day'
    const daySummary = taskTabStatsSnapshot?.today
    const summary = taskRangeSnapshot.summary

    const total = isDayRange && daySummary ? daySummary.total : summary.total
    const completed = isDayRange && daySummary ? daySummary.completed : summary.completed
    const partially = isDayRange && daySummary ? daySummary.partially : summary.partially
    const skipped = isDayRange && daySummary ? daySummary.skipped : summary.skipped
    const plannedWeight = isDayRange && daySummary ? daySummary.plannedWeight : summary.plannedWeight
    const earnedWeight = isDayRange && daySummary ? daySummary.earnedWeight : summary.earnedWeight
    const weightedProgress = isDayRange && daySummary ? daySummary.weightedProgress : summary.weightedProgress

    const pending = Math.max(total - completed - partially - skipped, 0)

    return {
      total,
      completed,
      partiallyCompleted: partially,
      skipped,
      inProgress: partially,
      pending,
      blocked: 0,
      overdue: isDayRange ? 0 : taskRangeSnapshot.overdue,
      earnedWeight,
      totalWeight: plannedWeight,
      weightedCompletionRate: weightedProgress,
      simpleCompletionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      byPriority: {
        high: taskRangeSnapshot.byPriority.high,
        medium: taskRangeSnapshot.byPriority.medium,
        low: taskRangeSnapshot.byPriority.low,
      },
      completedByPriority: {
        high: taskRangeSnapshot.byPriority.high.completed,
        medium: taskRangeSnapshot.byPriority.medium.completed,
        low: taskRangeSnapshot.byPriority.low.completed,
      },
    }
  }, [taskRangeSnapshot, taskTabStatsSnapshot?.today, timeRange])

  const productivityScore = useMemo(() => {
    return calculateProductivityScore(taskAnalytics, habitAnalytics)
  }, [habitAnalytics, taskAnalytics])

  // Fetch time_blocks data for the Analytics Time tab — tightly connected to Time page
  const { data: timeBlocksAnalytics } = useQuery({
    queryKey: ['time-analytics', timeRange, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!electron.isReady) return null
      const startStr = dateRange.start.toISOString()
      const endStr = dateRange.end.toISOString()

      const [totals, dailyBreakdown] = await Promise.all([
        electron.executeQuery(`
          SELECT 
            COALESCE(SUM(duration), 0) as total_time,
            COUNT(*) as total_sessions,
            COALESCE(SUM(CASE WHEN notes LIKE '%(complete)%' THEN 1 ELSE 0 END), 0) as completed_sessions,
            COUNT(DISTINCT DATE(start_time, 'localtime')) as active_days
          FROM time_blocks
          WHERE DATETIME(start_time) BETWEEN DATETIME(?) AND DATETIME(?)
          AND deleted_at IS NULL
          ${PRODUCTIVE_TIME_FILTER_SQL}
        `, [startStr, endStr]),

        electron.executeQuery(`
          SELECT 
            DATE(start_time, 'localtime') as date,
            COALESCE(SUM(duration), 0) as daily_total
          FROM time_blocks
          WHERE DATETIME(start_time) BETWEEN DATETIME(?) AND DATETIME(?)
          AND deleted_at IS NULL
          ${PRODUCTIVE_TIME_FILTER_SQL}
          GROUP BY DATE(start_time, 'localtime')
          ORDER BY date ASC
        `, [startStr, endStr]),
      ])

      const totalsRow = Array.isArray(totals) ? totals[0] : { total_time: 0, total_sessions: 0, completed_sessions: 0, active_days: 0 }
      const days = Array.isArray(dailyBreakdown) ? dailyBreakdown : []

      const totalTimeSeconds = totalsRow?.total_time || 0
      const activeDays = totalsRow?.active_days || 0
      const totalSessions = totalsRow?.total_sessions || 0
      const completedSessions = totalsRow?.completed_sessions || 0

      // Calculate days in range
      const msPerDay = 86400000
      const daysInRange = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / msPerDay) + 1)
      
      // Productivity: average daily time vs 6h target
      const avgDailySeconds = activeDays > 0 ? totalTimeSeconds / activeDays : 0
      const targetSeconds = 6 * 3600
      const productivity = Math.min(Math.round((avgDailySeconds / targetSeconds) * 100), 100)

      return {
        totalTimeSeconds,
        totalSessions,
        completedSessions,
        activeDays,
        daysInRange,
        productivity,
        avgDailySeconds,
        dailyBreakdown: days,
      }
    },
    enabled: electron.isReady,
  })

  const liveElapsedSeconds = useMemo(() => {
    if (!timerRunning || !isProductiveTimerMode || elapsedMs <= 0) return 0
    return Math.floor(elapsedMs / 1000)
  }, [elapsedMs, timerRunning, isProductiveTimerMode])

  const liveTimeBlocksAnalytics = useMemo(() => {
    if (!timeBlocksAnalytics) return null
    if (liveElapsedSeconds <= 0) return timeBlocksAnalytics

    const today = new Date()
    const rangeIncludesToday = dateRange.start <= today && dateRange.end >= today
    if (!rangeIncludesToday) return timeBlocksAnalytics

    const todayKey = format(today, 'yyyy-MM-dd')
    const baseBreakdown = Array.isArray(timeBlocksAnalytics.dailyBreakdown)
      ? [...timeBlocksAnalytics.dailyBreakdown]
      : []

    const todayIndex = baseBreakdown.findIndex((entry: any) => entry.date === todayKey)
    const hadTodayActivity = todayIndex !== -1 && (baseBreakdown[todayIndex]?.daily_total || 0) > 0

    if (todayIndex >= 0) {
      baseBreakdown[todayIndex] = {
        ...baseBreakdown[todayIndex],
        daily_total: (baseBreakdown[todayIndex]?.daily_total || 0) + liveElapsedSeconds,
      }
    } else {
      baseBreakdown.push({
        date: todayKey,
        daily_total: liveElapsedSeconds,
      })
      baseBreakdown.sort((a: any, b: any) => a.date.localeCompare(b.date))
    }

    const totalTimeSeconds = (timeBlocksAnalytics.totalTimeSeconds || 0) + liveElapsedSeconds
    const activeDays = hadTodayActivity
      ? timeBlocksAnalytics.activeDays || 0
      : Math.min((timeBlocksAnalytics.activeDays || 0) + 1, timeBlocksAnalytics.daysInRange || 1)
    const avgDailySeconds = activeDays > 0 ? totalTimeSeconds / activeDays : 0
    const targetSeconds = 6 * 3600
    const productivity = Math.min(Math.round((avgDailySeconds / targetSeconds) * 100), 100)

    return {
      ...timeBlocksAnalytics,
      totalTimeSeconds,
      activeDays,
      avgDailySeconds,
      productivity,
      dailyBreakdown: baseBreakdown,
    }
  }, [dateRange.end, dateRange.start, liveElapsedSeconds, timeBlocksAnalytics])
  
  const productivityDateRange = taskDateRange

  const productivityHabitSeries = useMemo(
    () => calculateHabitDueSeries(habits, allHabitCompletions, productivityDateRange, timeRange === 'week' ? 'short' : 'medium'),
    [habits, allHabitCompletions, productivityDateRange, timeRange]
  )

  const getWeightedProductivity = (
    taskPlannedWeight: number,
    taskEarnedWeight: number,
    dueHabits: number,
    completedDueHabits: number
  ) => {
    const taskCompletion = taskPlannedWeight > 0
      ? (taskEarnedWeight / taskPlannedWeight) * 100
      : 0
    const habitCompletion = dueHabits > 0
      ? (completedDueHabits / dueHabits) * 100
      : 0

    if (dueHabits <= 0) {
      return Math.round(taskCompletion)
    }

    const totalCategoryWeight = 20 + 4
    const taskContribution = taskCompletion * 20
    const habitContribution = habitCompletion * 4
    return Math.round((taskContribution + habitContribution) / totalCategoryWeight)
  }

  const productivityChartData = useMemo(() => {
    const habitByDate = new Map(
      productivityHabitSeries.map((point) => [point.fullDate, point])
    )

    const daily = taskRangeSnapshot.daily
      .filter((point) => point.dateKey <= format(productivityDateRange.end, 'yyyy-MM-dd'))
      .map((point) => {
        const habitPoint = habitByDate.get(point.dateKey)
        const taskPlannedWeight = point.plannedWeight
        const taskEarnedWeight = point.earnedWeight
        const dueHabits = habitPoint?.dueHabits || 0
        const completedDueHabits = habitPoint?.completedDueHabits || 0
        const productivity = getWeightedProductivity(
          taskPlannedWeight,
          taskEarnedWeight,
          dueHabits,
          completedDueHabits
        )

        return {
          date: point.date,
          fullDate: point.dateKey,
          taskPlannedWeight,
          taskEarnedWeight,
          dueHabits,
          completedDueHabits,
          productivity,
        }
      })

    if (timeRange === 'day' || timeRange === 'week' || timeRange === 'month') {
      return daily
    }

    if (timeRange === 'quarter') {
      const byWeek = new Map<string, { taskPlannedWeight: number; taskEarnedWeight: number; dueHabits: number; completedDueHabits: number }>()

      daily.forEach((point) => {
        const pointDate = parseISO(point.fullDate)
        const bucketStart = startOfWeek(pointDate, { weekStartsOn: 1 })
        const bucketKey = format(bucketStart, 'yyyy-MM-dd')
        const current = byWeek.get(bucketKey) || { taskPlannedWeight: 0, taskEarnedWeight: 0, dueHabits: 0, completedDueHabits: 0 }
        current.taskPlannedWeight += point.taskPlannedWeight
        current.taskEarnedWeight += point.taskEarnedWeight
        current.dueHabits += point.dueHabits
        current.completedDueHabits += point.completedDueHabits
        byWeek.set(bucketKey, current)
      })

      return Array.from(byWeek.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([bucketKey, value]) => ({
          date: format(parseISO(bucketKey), 'MMM d'),
          fullDate: bucketKey,
          taskPlannedWeight: value.taskPlannedWeight,
          taskEarnedWeight: value.taskEarnedWeight,
          dueHabits: value.dueHabits,
          completedDueHabits: value.completedDueHabits,
          productivity: getWeightedProductivity(
            value.taskPlannedWeight,
            value.taskEarnedWeight,
            value.dueHabits,
            value.completedDueHabits
          ),
        }))
    }

    const byMonth = new Map<string, { taskPlannedWeight: number; taskEarnedWeight: number; dueHabits: number; completedDueHabits: number }>()
    daily.forEach((point) => {
      const pointDate = parseISO(point.fullDate)
      const bucketStart = startOfMonth(pointDate)
      const bucketKey = format(bucketStart, 'yyyy-MM')
      const current = byMonth.get(bucketKey) || { taskPlannedWeight: 0, taskEarnedWeight: 0, dueHabits: 0, completedDueHabits: 0 }
      current.taskPlannedWeight += point.taskPlannedWeight
      current.taskEarnedWeight += point.taskEarnedWeight
      current.dueHabits += point.dueHabits
      current.completedDueHabits += point.completedDueHabits
      byMonth.set(bucketKey, current)
    })

    const monthBuckets: Array<{ date: string; fullDate: string; taskPlannedWeight: number; taskEarnedWeight: number; dueHabits: number; completedDueHabits: number; productivity: number }> = []
    let monthCursor = startOfMonth(productivityDateRange.start)
    const monthEndKey = format(startOfMonth(productivityDateRange.end), 'yyyy-MM')

    while (format(monthCursor, 'yyyy-MM') <= monthEndKey) {
      const bucketKey = format(monthCursor, 'yyyy-MM')
      const value = byMonth.get(bucketKey) || { taskPlannedWeight: 0, taskEarnedWeight: 0, dueHabits: 0, completedDueHabits: 0 }
      monthBuckets.push({
        date: format(monthCursor, 'MMM'),
        fullDate: bucketKey,
        taskPlannedWeight: value.taskPlannedWeight,
        taskEarnedWeight: value.taskEarnedWeight,
        dueHabits: value.dueHabits,
        completedDueHabits: value.completedDueHabits,
        productivity: getWeightedProductivity(
          value.taskPlannedWeight,
          value.taskEarnedWeight,
          value.dueHabits,
          value.completedDueHabits
        ),
      })
      monthCursor = addMonths(monthCursor, 1)
    }

    return monthBuckets
  }, [productivityDateRange.end, productivityHabitSeries, taskRangeSnapshot.daily, timeRange])

  const habitDueSeries = useMemo(
    () => calculateHabitDueSeries(
      habits,
      allHabitCompletions,
      habitDateRange,
      timeRange === 'day' || timeRange === 'week' ? 'short' : 'medium'
    ),
    [habits, allHabitCompletions, habitDateRange, timeRange]
  )

  const habitDueToday = useMemo(
    () => calculateHabitDueMetricsForDay(habits, allHabitCompletions, new Date(), 'short'),
    [habits, allHabitCompletions]
  )

  const habitDueChartData = useMemo(() => {
    if (timeRange === 'day' || timeRange === 'week' || timeRange === 'month') {
      return habitDueSeries.map((point) => ({
        date: point.date,
        fullDate: point.fullDate,
        dueHabits: point.dueHabits,
        completedDueHabits: point.completedDueHabits,
        consistency: point.consistency,
      }))
    }

    const aggregateBy = timeRange === 'quarter' ? 'week' : 'month'
    const grouped: Record<string, { date: string; fullDate: string; dueHabits: number; completedDueHabits: number; consistency: number }> = {}

    habitDueSeries.forEach((point) => {
      const date = parseISO(point.fullDate)
      const periodStart = aggregateBy === 'week'
        ? startOfWeek(date, { weekStartsOn: 1 })
        : startOfMonth(date)
      const periodKey = format(periodStart, aggregateBy === 'week' ? 'yyyy-MM-dd' : 'yyyy-MM')

      if (!grouped[periodKey]) {
        grouped[periodKey] = {
          date: aggregateBy === 'week' ? format(periodStart, 'MMM d') : format(periodStart, 'MMM'),
          fullDate: periodKey,
          dueHabits: 0,
          completedDueHabits: 0,
          consistency: 0,
        }
      }

      grouped[periodKey].dueHabits += point.dueHabits
      grouped[periodKey].completedDueHabits += point.completedDueHabits
    })

    return Object.values(grouped)
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
      .map((group) => ({
        ...group,
        consistency: group.dueHabits > 0
          ? Math.round((group.completedDueHabits / group.dueHabits) * 100)
          : 0,
      }))
  }, [habitDueSeries, timeRange])

  const taskChartData = useMemo(() => {
    const daily = taskRangeSnapshot.daily.map((point) => ({
      date: point.date,
      fullDate: point.dateKey,
      completed: point.completed,
      partiallyCompleted: point.partially,
      skipped: point.skipped,
    }))

    if (timeRange === 'day') {
      return [{
        date: format(taskDateRange.start, 'MMM d'),
        fullDate: format(taskDateRange.start, 'yyyy-MM-dd'),
        completed: taskAnalytics.completed,
        partiallyCompleted: taskAnalytics.partiallyCompleted,
        skipped: taskAnalytics.skipped,
      }]
    }

    if (timeRange === 'week' || timeRange === 'month') {
      return daily
    }

    const aggregateBy = timeRange === 'quarter' ? 'week' : 'month'
    const grouped: Record<string, { date: string; fullDate: string; completed: number; partiallyCompleted: number; skipped: number }> = {}

    daily.forEach((point) => {
      const date = parseISO(point.fullDate)
      const periodStart = aggregateBy === 'week'
        ? startOfWeek(date, { weekStartsOn: 1 })
        : startOfMonth(date)
      const periodKey = format(periodStart, aggregateBy === 'week' ? 'yyyy-MM-dd' : 'yyyy-MM')

      if (!grouped[periodKey]) {
        grouped[periodKey] = {
          date: aggregateBy === 'week' ? format(periodStart, 'MMM d') : format(periodStart, 'MMM'),
          fullDate: periodKey,
          completed: 0,
          partiallyCompleted: 0,
          skipped: 0,
        }
      }

      grouped[periodKey].completed += point.completed
      grouped[periodKey].partiallyCompleted += point.partiallyCompleted
      grouped[periodKey].skipped += point.skipped
    })

    return Object.values(grouped).sort((a, b) => a.fullDate.localeCompare(b.fullDate))
  }, [taskAnalytics.completed, taskAnalytics.partiallyCompleted, taskAnalytics.skipped, taskDateRange.start, taskRangeSnapshot.daily, timeRange])
  
  // ============================================
  // PIE CHART DATA
  // ============================================
  const taskStatusPieData = [
    { name: 'Completed', value: taskAnalytics.completed, color: '#22c55e' },
    { name: 'Partially', value: taskAnalytics.partiallyCompleted, color: '#3b82f6' },
    { name: 'Skipped/Overdue', value: taskAnalytics.skipped + taskAnalytics.overdue, color: '#94a3b8' }
  ].filter(item => item.value > 0)
  
  const taskPriorityPieData = [
    { name: 'High', value: taskAnalytics.byPriority.high.total, color: '#ef4444' },
    { name: 'Medium', value: taskAnalytics.byPriority.medium.total, color: '#f59e0b' },
    { name: 'Low', value: taskAnalytics.byPriority.low.total, color: '#22c55e' }
  ].filter(item => item.value > 0)
  
  const goalCategoryPieData = [
    { name: 'Career', value: goalAnalytics.byCategory.career.length, color: COLORS[0] },
    { name: 'Health', value: goalAnalytics.byCategory.health.length, color: COLORS[1] },
    { name: 'Learning', value: goalAnalytics.byCategory.learning.length, color: COLORS[2] },
    { name: 'Finance', value: goalAnalytics.byCategory.finance.length, color: COLORS[3] },
    { name: 'Personal', value: goalAnalytics.byCategory.personal.length, color: COLORS[4] },
    { name: 'Custom', value: goalAnalytics.byCategory.custom.length, color: COLORS[5] }
  ].filter(item => item.value > 0)
  
  const habitFrequencyPieData = [
    { name: 'Daily', value: habitAnalytics.byFrequency.daily.length, color: '#22c55e' },
    { name: 'Weekly', value: habitAnalytics.byFrequency.weekly.length, color: '#3b82f6' },
    { name: 'Monthly', value: habitAnalytics.byFrequency.monthly.length, color: '#f59e0b' }
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-3xl font-bold">Analytics</h1>
            <ContextTipsDialog
              title="Analytics Tab Tips"
              description="Use analytics as a decision tool for planning, focus, and improvement."
              sections={ANALYTICS_TIPS_SECTIONS}
              triggerLabel="Open analytics tips"
              onboardingKey="analytics-tab-tips"
            />
          </div>
          <p className="text-muted-foreground">
            Insights and trends from your progress data
          </p>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Time Range:</span>
              <span className="text-xs text-muted-foreground">
                ({format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')})
              </span>
            </div>
            <div className="flex gap-2">
              {(['day', 'week', 'month', 'quarter', 'year'] as const).map(range => (
                <Button
                  key={range}
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "shadow-none transition-all duration-200",
                    timeRange === range
                      ? "bg-green-500 text-white hover:bg-green-600 dark:bg-green-500 dark:text-zinc-950 dark:hover:bg-green-400"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800/70 dark:text-zinc-100 dark:hover:bg-green-500/20"
                  )}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full bg-secondary/30 dark:bg-secondary/20 p-1 h-12 border-transparent">
          <TabsTrigger value="overview" className="flex-1">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1">
            <ListTodo className="mr-2 h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex-1">
            <Target className="mr-2 h-4 w-4" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="habits" className="flex-1">
            <Repeat className="mr-2 h-4 w-4" />
            Habits
          </TabsTrigger>
          <TabsTrigger value="time" className="flex-1">
            <Timer className="mr-2 h-4 w-4" />
            Time
          </TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* OVERVIEW TAB */}
        {/* ============================================ */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
                <Zap className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productivityScore.overall}%</div>
                <Progress value={productivityScore.overall} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {productivityScore.breakdown.hasHabits 
                    ? `Tasks (${productivityScore.taskComponent}%) + Habits (${productivityScore.habitComponent}%) `
                    : `Tasks (${productivityScore.taskComponent}%) — no habits tracked`
                  }
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskAnalytics.weightedCompletionRate}%</div>
                <Progress value={taskAnalytics.weightedCompletionRate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Earned {taskAnalytics.earnedWeight} / Planned {taskAnalytics.totalWeight}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Habit Consistency</CardTitle>
                <Repeat className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{habitAnalytics.avgConsistency}%</div>
                <Progress value={habitAnalytics.avgConsistency} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {habitAnalytics.total} habits, {habitAnalytics.totalCurrentStreak} total streak
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                <Target className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{goalAnalytics.active}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {goalAnalytics.completedInRange} completed this period
                </p>
                {goalAnalytics.overdue > 0 && (
                  <Badge variant="destructive" className="mt-2 text-xs">
                    {goalAnalytics.overdue} overdue
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Productivity Over Time</CardTitle>
              <CardDescription>Weighted productivity by selected period (task weight + due habits)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={productivityChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="productivity" 
                      name="Productivity Score"
                      stroke="#f59e0b" 
                      fill="#f59e0b" 
                      fillOpacity={0.4}
                      connectNulls={true}
                      isAnimationActive={true}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weight Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Task Weight Completed</span>
                  <span className="font-bold">{taskAnalytics.earnedWeight}/{taskAnalytics.totalWeight}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Habit Weight (Streaks)</span>
                  <span className="font-bold">{habitAnalytics.totalHabitWeight}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">Total Effort</span>
                  <span className="font-bold text-green-500">
                    {taskAnalytics.earnedWeight + habitAnalytics.totalHabitWeight}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Task Completion</span>
                  <span className="font-bold">{taskAnalytics.weightedCompletionRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Habit Consistency</span>
                  <span className="font-bold">{habitAnalytics.avgConsistency}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Active Goals</span>
                  <span className="font-bold">{goalAnalytics.active}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Goals Completed</span>
                  <span className="font-bold">{goalAnalytics.completedInRange || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Activity Days</span>
                  <span className="font-bold">{timeAnalytics.daysWithActivity}/{timeAnalytics.daysInRange}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {taskAnalytics.weightedCompletionRate >= 70 ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Great task completion!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-500">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm">Focus on high-priority tasks</span>
                  </div>
                )}
                {habitAnalytics.avgConsistency >= 70 ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <Award className="h-4 w-4" />
                    <span className="text-sm">Strong habit consistency!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-500">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm">Build stronger habits</span>
                  </div>
                )}
                {taskAnalytics.overdue > 0 && (
                  <div className="flex items-center gap-2 text-red-500">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{taskAnalytics.overdue} tasks overdue</span>
                  </div>
                )}
                {goalAnalytics.overdue > 0 && (
                  <div className="flex items-center gap-2 text-red-500">
                    <Target className="h-4 w-4" />
                    <span className="text-sm">{goalAnalytics.overdue} goals overdue</span>
                  </div>
                )}
                {timeAnalytics.activityRate > 0 && (
                  <div className="flex items-center gap-2 text-blue-500">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Active on {timeAnalytics.activityRate}% of days</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TASKS TAB */}
        {/* ============================================ */}
        <TabsContent value="tasks" className="mt-6 space-y-6">
          {/* Task Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weighted Completion</CardTitle>
                <Zap className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskAnalytics.weightedCompletionRate}%</div>
                <Progress value={taskAnalytics.weightedCompletionRate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {taskAnalytics.earnedWeight}/{taskAnalytics.totalWeight} weight
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Simple Completion</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskAnalytics.simpleCompletionRate}%</div>
                <Progress value={taskAnalytics.simpleCompletionRate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {taskAnalytics.completed}/{taskAnalytics.total} tasks
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Partially Completed</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskAnalytics.partiallyCompleted}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tasks with 25%-75% progress
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <Clock className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{taskAnalytics.overdue}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tasks past due date
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Status Pie */}
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {taskStatusPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={taskStatusPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {taskStatusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No task data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Priority Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Priority Breakdown</CardTitle>
                <CardDescription>
                  Weight: High(3) · Medium(2) · Low(1)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {taskPriorityPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { 
                          name: 'High', 
                          total: taskAnalytics.byPriority.high.total,
                          completed: taskAnalytics.completedByPriority.high,
                          weight: taskAnalytics.byPriority.high.plannedWeight
                        },
                        { 
                          name: 'Medium', 
                          total: taskAnalytics.byPriority.medium.total,
                          completed: taskAnalytics.completedByPriority.medium,
                          weight: taskAnalytics.byPriority.medium.plannedWeight
                        },
                        { 
                          name: 'Low', 
                          total: taskAnalytics.byPriority.low.total,
                          completed: taskAnalytics.completedByPriority.low,
                          weight: taskAnalytics.byPriority.low.plannedWeight
                        }
                      ]} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={60} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="total" name="Total" fill="#94a3b8" />
                        <Bar dataKey="completed" name="Completed" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No task data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Task Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Task Completion Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="partiallyCompleted" name="Partially Completed" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="skipped" name="Skipped" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* GOALS TAB */}
        {/* ============================================ */}
        <TabsContent value="goals" className="mt-6 space-y-6">
          {/* Goal Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
                <Target className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{goalAnalytics.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {goalAnalytics.newInRange} created this period
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{goalAnalytics.active}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {goalAnalytics.paused} paused
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{goalAnalytics.completed}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {goalAnalytics.completedInRange} this period
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <Clock className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{goalAnalytics.overdue}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Goals past target date
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Goals by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {goalCategoryPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={goalCategoryPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {goalCategoryPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No goal data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Linked Tasks Progress</CardTitle>
                <CardDescription>Task completion rate for goal-linked tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Linked Tasks</span>
                    <span className="font-bold">{goalAnalytics.totalLinkedTasks}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Completed</span>
                    <span className="font-bold text-green-500">{goalAnalytics.completedLinkedTasks}</span>
                  </div>
                  <Progress value={goalAnalytics.linkedTaskCompletionRate} className="h-3" />
                  <div className="text-center text-2xl font-bold">
                    {goalAnalytics.linkedTaskCompletionRate}%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Goals with Tasks Table */}
          <Card>
            <CardHeader>
              <CardTitle>Goal Task Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {goalAnalytics.goalsWithTasks.slice(0, 10).map((goal: GoalWithProgress) => (
                  <div key={goal.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1">
                      <p className="font-medium truncate">{goal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {goal.completedTasksCount}/{goal.linkedTasksCount} tasks completed
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={goal.taskProgress} className="w-24 h-2" />
                      <span className="text-sm font-bold w-12 text-right">{goal.taskProgress}%</span>
                    </div>
                  </div>
                ))}
                {goalAnalytics.goalsWithTasks.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No goals with linked tasks
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* HABITS TAB */}
        {/* ============================================ */}
        <TabsContent value="habits" className="mt-6 space-y-6">
          {/* Habit Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Habits</CardTitle>
                <Repeat className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{habitAnalytics.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {habitAnalytics.newInRange} created this period
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Consistency</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{habitAnalytics.avgConsistency}%</div>
                <Progress value={habitAnalytics.avgConsistency} className="mt-2" />
               
                {habitDueToday.earlyCompletedHabits > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">Completed Early : {habitDueToday.earlyCompletedHabits}</div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Streak</CardTitle>
                <Zap className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{habitAnalytics.totalCurrentStreak}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Combined current streaks
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Best Streak</CardTitle>
                <Award className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{habitAnalytics.maxStreak}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Longest streak achieved
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Habit Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Habits by Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {habitFrequencyPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={habitFrequencyPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {habitFrequencyPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No habit data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Habit Weight Contribution</CardTitle>
                <CardDescription>Each completed habit = 1 weight point per streak day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-500">
                      {habitAnalytics.totalHabitWeight}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Habit Weight</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-xl font-bold">{habitAnalytics.byFrequency.daily.length}</div>
                      <p className="text-xs text-muted-foreground">Daily</p>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{habitAnalytics.byFrequency.weekly.length}</div>
                      <p className="text-xs text-muted-foreground">Weekly</p>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{habitAnalytics.byFrequency.monthly.length}</div>
                      <p className="text-xs text-muted-foreground">Monthly</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Due Habit Consistency Trend</CardTitle>
              <CardDescription>Only due habits affect today&apos;s score · Completed Today / Due Today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {habitDueChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={habitDueChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="dueHabits" name="Due Habits" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completedDueHabits" name="Completed Due" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No due-habit data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top & Struggling Habits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-500" />
                  Top Performing Habits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {habitAnalytics.topHabits.map((habit, index) => (
                    <div key={habit.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-green-500">#{index + 1}</span>
                        <div>
                          <p className="font-medium">{habit.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {habit.streak_current} day streak
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                        {habit.consistency_score}%
                      </Badge>
                    </div>
                  ))}
                  {habitAnalytics.topHabits.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No habits yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-yellow-500" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {habitAnalytics.strugglingHabits.map((habit) => (
                    <div key={habit.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
                      <div>
                        <p className="font-medium">{habit.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {habit.streak_current} day streak
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                        {habit.consistency_score}%
                      </Badge>
                    </div>
                  ))}
                  {habitAnalytics.strugglingHabits.length === 0 && (
                    <p className="text-center text-green-500 py-4">
                      All habits performing well! 🎉
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TIME TAB — data from time_blocks (same source as Time page) */}
        {/* ============================================ */}
        <TabsContent value="time" className="mt-6 space-y-6">
          {/* Time Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Time Tracked</CardTitle>
                <Timer className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(() => {
                    const sec = liveTimeBlocksAnalytics?.totalTimeSeconds || 0
                    const h = Math.floor(sec / 3600)
                    const m = Math.floor((sec % 3600) / 60)
                    return `${h}h ${m}m`
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {liveTimeBlocksAnalytics?.totalSessions || 0} sessions • {liveTimeBlocksAnalytics?.completedSessions || 0} completed in this period
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productivity</CardTitle>
                <Zap className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {liveTimeBlocksAnalytics?.productivity || 0}%
                </div>
                <Progress value={Math.min(liveTimeBlocksAnalytics?.productivity || 0, 100)} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  vs 6h daily target
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Days</CardTitle>
                <Calendar className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{liveTimeBlocksAnalytics?.activeDays || 0}</div>
                <Progress 
                  value={liveTimeBlocksAnalytics?.daysInRange ? Math.round(((liveTimeBlocksAnalytics?.activeDays || 0) / liveTimeBlocksAnalytics.daysInRange) * 100) : 0} 
                  className="mt-2" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {liveTimeBlocksAnalytics?.daysInRange ? Math.round(((liveTimeBlocksAnalytics?.activeDays || 0) / liveTimeBlocksAnalytics.daysInRange) * 100) : 0}% of {liveTimeBlocksAnalytics?.daysInRange || 0} days
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(() => {
                    const sec = liveTimeBlocksAnalytics?.avgDailySeconds || 0
                    const h = Math.floor(sec / 3600)
                    const m = Math.floor((sec % 3600) / 60)
                    return `${h}h ${m}m`
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per active day
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Time Distribution Chart */}
          {liveTimeBlocksAnalytics?.dailyBreakdown && liveTimeBlocksAnalytics.dailyBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Time Distribution</CardTitle>
                <CardDescription>Daily tracked time across the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={liveTimeBlocksAnalytics.dailyBreakdown.map((d: any) => ({
                      date: format(parseISO(d.date), timeRange === 'day' ? 'HH:mm' : timeRange === 'year' ? 'MMM' : 'MMM d'),
                      hours: Math.round((d.daily_total / 3600) * 100) / 100,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} className="text-xs" />
                      <Tooltip 
                        formatter={(value: any) => {
                          const h = Math.floor(Number(value))
                          const m = Math.round((Number(value) - h) * 60)
                          return [`${h}h ${m}m`, 'Time']
                        }}
                      />
                      <Bar dataKey="hours" name="Time Tracked" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-blue-500">
                    {(() => {
                      const sec = liveTimeBlocksAnalytics?.totalTimeSeconds || 0
                      return `${Math.floor(sec / 3600)}h`
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Tracked</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-green-500">
                    {liveTimeBlocksAnalytics?.activeDays || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Active Days</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-purple-500">
                    {liveTimeBlocksAnalytics?.totalSessions || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Total Sessions ({liveTimeBlocksAnalytics?.completedSessions || 0} completed)
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-yellow-500">
                    {liveTimeBlocksAnalytics?.productivity 
                      ? (liveTimeBlocksAnalytics.productivity > 80 ? '\u26a1' : liveTimeBlocksAnalytics.productivity >= 50 ? '\u2713' : '\u26a0')
                      : '\u26a0'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {liveTimeBlocksAnalytics?.productivity 
                      ? (liveTimeBlocksAnalytics.productivity > 80 ? 'Great pace!' : liveTimeBlocksAnalytics.productivity >= 50 ? 'On track' : 'Below target')
                      : 'No data'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}