import { useState, useMemo } from 'react'
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
  Download,
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
import { format, parseISO } from 'date-fns'
import { useStore } from '@/store'
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
  getDateRange,
  calculateTaskAnalytics,
  calculateHabitAnalytics,
  calculateGoalAnalytics,
  calculateTimeAnalytics,
  calculateProductivityScore,
  calculateTrendData,
  PRIORITY_WEIGHTS,
  type TimeRange,
  type GoalWithProgress
} from '@/lib/progress'

// Color palette for charts
const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

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
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  
  // Get date range based on selected time range
  const dateRange = useMemo(() => getDateRange(timeRange), [timeRange])
  
  // ============================================
  // USE CENTRALIZED ANALYTICS (Single Source of Truth)
  // ============================================
  const taskAnalytics = useMemo(() => 
    calculateTaskAnalytics(tasks, dateRange), 
    [tasks, dateRange]
  )
  
  const habitAnalytics = useMemo(() => 
    calculateHabitAnalytics(habits), 
    [habits]
  )
  
  const goalAnalytics = useMemo(() => 
    calculateGoalAnalytics(goals, tasks, habits), 
    [goals, tasks, habits]
  )
  
  const timeAnalytics = useMemo(() => 
    calculateTimeAnalytics(tasks, dateRange), 
    [tasks, dateRange]
  )
  
  const productivityScore = useMemo(() => 
    calculateProductivityScore(taskAnalytics, habitAnalytics), 
    [taskAnalytics, habitAnalytics]
  )
  
  // ============================================
  // TREND DATA FOR CHARTS
  // ============================================
  const trendData = useMemo(() => 
    calculateTrendData(
      tasks, 
      habits, 
      dateRange, 
      timeRange === 'week' ? 'short' : 'medium'
    ), 
    [tasks, habits, dateRange, timeRange]
  )
  
  // Aggregate for year view (by month)
  const aggregatedTrendData = useMemo(() => {
    if (timeRange !== 'year') return trendData
    
    const monthlyData: Record<string, any> = {}
    
    trendData.forEach(day => {
      const monthKey = format(parseISO(day.fullDate), 'MMM yyyy')
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          date: format(parseISO(day.fullDate), 'MMM'),
          fullDate: monthKey,
          tasks: 0,
          completed: 0,
          weightedCompleted: 0,
          habits: day.habits,
          habitsCompleted: 0,
          productivity: 0,
          count: 0
        }
      }
      monthlyData[monthKey].tasks += day.tasks
      monthlyData[monthKey].completed += day.completed
      monthlyData[monthKey].weightedCompleted += day.weightedCompleted
      monthlyData[monthKey].habitsCompleted += day.habitsCompleted
      monthlyData[monthKey].productivity += day.productivity
      monthlyData[monthKey].count += 1
    })
    
    return Object.values(monthlyData).map((m: any) => ({
      ...m,
      productivity: Math.round(m.productivity / m.count)
    }))
  }, [trendData, timeRange])
  
  const chartData = timeRange === 'year' ? aggregatedTrendData : trendData
  
  // ============================================
  // PIE CHART DATA
  // ============================================
  const taskStatusPieData = [
    { name: 'Completed', value: taskAnalytics.completed, color: '#22c55e' },
    { name: 'In Progress', value: taskAnalytics.inProgress, color: '#3b82f6' },
    { name: 'Pending', value: taskAnalytics.pending, color: '#f59e0b' },
    { name: 'Blocked', value: taskAnalytics.blocked, color: '#ef4444' }
  ].filter(item => item.value > 0)
  
  const taskPriorityPieData = [
    { name: 'Critical', value: taskAnalytics.byPriority.critical.length, color: '#ef4444' },
    { name: 'High', value: taskAnalytics.byPriority.high.length, color: '#f59e0b' },
    { name: 'Medium', value: taskAnalytics.byPriority.medium.length, color: '#3b82f6' },
    { name: 'Low', value: taskAnalytics.byPriority.low.length, color: '#22c55e' }
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

  const exportAnalytics = () => {
    const data = {
      timeRange,
      dateRange: {
        start: format(dateRange.start, 'yyyy-MM-dd'),
        end: format(dateRange.end, 'yyyy-MM-dd')
      },
      taskAnalytics,
      habitAnalytics,
      goalAnalytics,
      timeAnalytics,
      productivityScore
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Insights and trends from your progress data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportAnalytics}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
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
              {(['week', 'month', 'quarter', 'year'] as const).map(range => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "shadow-none border-transparent",
                    timeRange !== range && "bg-secondary/50 hover:bg-secondary/80 dark:bg-secondary/30 dark:hover:bg-secondary/50"
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
        <TabsList className="w-full">
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
                  Tasks ({taskAnalytics.weightedCompletionRate}%) + Habits ({habitAnalytics.avgConsistency}%)
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskAnalytics.weightedCompletionRate}%</div>
                <Progress value={taskAnalytics.weightedCompletionRate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {taskAnalytics.completed}/{taskAnalytics.total} tasks (weighted)
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
              <CardTitle>Progress Trends</CardTitle>
              <CardDescription>Task completion and productivity over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      name="Completed Tasks"
                      stroke="#22c55e" 
                      fill="#22c55e" 
                      fillOpacity={0.3} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="tasks" 
                      name="Total Tasks"
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.1} 
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
                  <span className="font-bold">{taskAnalytics.completedWeight}/{taskAnalytics.totalWeight}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Habit Weight (Streaks)</span>
                  <span className="font-bold">{habitAnalytics.totalHabitWeight}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-medium">Total Effort</span>
                  <span className="font-bold text-green-500">
                    {taskAnalytics.completedWeight + habitAnalytics.totalHabitWeight}
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
                  <span className="text-sm text-muted-foreground">Days Active</span>
                  <span className="font-bold">{timeAnalytics.daysWithActivity}/{timeAnalytics.daysInRange}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Activity Rate</span>
                  <span className="font-bold">{timeAnalytics.activityRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Best Streak</span>
                  <span className="font-bold">{habitAnalytics.maxStreak} days</span>
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
                  {taskAnalytics.completedWeight}/{taskAnalytics.totalWeight} weight
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
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskAnalytics.inProgress}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {taskAnalytics.pending} pending, {taskAnalytics.blocked} blocked
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
                  Weight: Critical(4) · High(3) · Medium(2) · Low(1)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {taskPriorityPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { 
                          name: 'Critical', 
                          total: taskAnalytics.byPriority.critical.length,
                          completed: taskAnalytics.completedByPriority.critical,
                          weight: taskAnalytics.byPriority.critical.length * PRIORITY_WEIGHTS.critical
                        },
                        { 
                          name: 'High', 
                          total: taskAnalytics.byPriority.high.length,
                          completed: taskAnalytics.completedByPriority.high,
                          weight: taskAnalytics.byPriority.high.length * PRIORITY_WEIGHTS.high
                        },
                        { 
                          name: 'Medium', 
                          total: taskAnalytics.byPriority.medium.length,
                          completed: taskAnalytics.completedByPriority.medium,
                          weight: taskAnalytics.byPriority.medium.length * PRIORITY_WEIGHTS.medium
                        },
                        { 
                          name: 'Low', 
                          total: taskAnalytics.byPriority.low.length,
                          completed: taskAnalytics.completedByPriority.low,
                          weight: taskAnalytics.byPriority.low.length * PRIORITY_WEIGHTS.low
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
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="tasks" name="Due Tasks" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="weightedCompleted" name="Weighted" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                <p className="text-xs text-muted-foreground mt-1">
                  Across all habits
                </p>
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
        {/* TIME TAB */}
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
                  {Math.floor(timeAnalytics.totalActualTime / 60)}h {timeAnalytics.totalActualTime % 60}m
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From completed tasks
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Time Efficiency</CardTitle>
                <Zap className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {timeAnalytics.timeEfficiency}%
                </div>
                <Progress value={Math.min(timeAnalytics.timeEfficiency, 100)} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Estimated vs Actual
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Days</CardTitle>
                <Calendar className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{timeAnalytics.daysWithActivity}</div>
                <Progress 
                  value={timeAnalytics.activityRate} 
                  className="mt-2" 
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {timeAnalytics.activityRate}% of {timeAnalytics.daysInRange} days
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
                  {Math.floor(timeAnalytics.avgDailyTime / 60)}h {timeAnalytics.avgDailyTime % 60}m
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per active day
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Time Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Time Estimate Accuracy</CardTitle>
              <CardDescription>Comparing estimated vs actual time spent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { 
                      name: 'Estimated', 
                      value: timeAnalytics.totalEstimatedTime,
                      fill: '#3b82f6'
                    },
                    { 
                      name: 'Actual', 
                      value: timeAnalytics.totalActualTime,
                      fill: '#22c55e'
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value) => {
                        const num = Number(value) || 0
                        return [`${Math.floor(num / 60)}h ${num % 60}m`, 'Time']
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="#3b82f6" />
                      <Cell fill="#22c55e" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-blue-500">
                    {Math.floor(timeAnalytics.totalEstimatedTime / 60)}h
                  </div>
                  <p className="text-sm text-muted-foreground">Estimated</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-green-500">
                    {Math.floor(timeAnalytics.totalActualTime / 60)}h
                  </div>
                  <p className="text-sm text-muted-foreground">Actual</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-purple-500">
                    {timeAnalytics.daysWithActivity}
                  </div>
                  <p className="text-sm text-muted-foreground">Active Days</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <div className="text-3xl font-bold text-yellow-500">
                    {timeAnalytics.timeEfficiency > 100 ? '⚡' : timeAnalytics.timeEfficiency >= 80 ? '✓' : '⚠'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {timeAnalytics.timeEfficiency > 100 
                      ? 'Under budget!' 
                      : timeAnalytics.timeEfficiency >= 80 
                      ? 'On track' 
                      : 'Over budget'}
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