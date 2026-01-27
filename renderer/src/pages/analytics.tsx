import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Target,
  PieChart,
  LineChart,
  Download,
  Filter
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { ProgressChart } from '@/components/progress-chart'
import { cn } from '@/lib/utils'

interface TaskStats {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  avg_estimated_time: number;
  avg_actual_time: number;
}

interface GoalStats {
  total_goals: number;
  avg_progress: number;
  completed_goals: number;
  on_time_rate: number;
}

interface HabitStats {
  total_habits: number;
  avg_consistency: number;
  avg_streak: number;
  max_streak: number;
}

interface TimeStats {
  total_focus_time: number;
  avg_session_length: number;
  days_with_focus: number;
}

interface ProductivityTrend {
  date: string;
  completed_tasks: number;
  total_estimated_time: number;
  total_actual_time: number;
}

interface AnalyticsData {
  taskStats: TaskStats;
  goalStats: GoalStats;
  habitStats: HabitStats;
  timeStats: TimeStats;
  productivityTrends: ProductivityTrend[];
}

export default function Analytics() {
  const electron = useElectron()
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [category, setCategory] = useState<'all' | 'tasks' | 'goals' | 'habits' | 'time'>('all')

  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', timeRange, category],
    queryFn: async () => {
      const startDate = timeRange === 'week' 
        ? format(subDays(new Date(), 7), 'yyyy-MM-dd')
        : timeRange === 'month'
        ? format(startOfMonth(new Date()), 'yyyy-MM-dd')
        : timeRange === 'quarter'
        ? format(subDays(new Date(), 90), 'yyyy-MM-dd')
        : format(subDays(new Date(), 365), 'yyyy-MM-dd')

      const endDate = format(new Date(), 'yyyy-MM-dd')

      // Fetch comprehensive analytics data
      const [
        taskStats,
        goalStats,
        habitStats,
        timeStats,
        productivityTrends
      ] = await Promise.all([
        // Task statistics
        electron.executeQuery<TaskStats[]>(`
          SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0 END) * 100 as completion_rate,
            AVG(estimated_time) as avg_estimated_time,
            AVG(actual_time) as avg_actual_time
          FROM tasks 
          WHERE created_at BETWEEN ? AND ?
          AND deleted_at IS NULL
        `, [startDate, endDate]),

        // Goal statistics
        electron.executeQuery<GoalStats[]>(`
          SELECT 
            COUNT(*) as total_goals,
            AVG(progress) as avg_progress,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_goals,
            AVG(CASE WHEN target_date IS NOT NULL AND target_date < ? THEN 1.0 ELSE 0 END) * 100 as on_time_rate
          FROM goals 
          WHERE created_at BETWEEN ? AND ?
          AND deleted_at IS NULL
        `, [endDate, startDate, endDate]),

        // Habit statistics
        electron.executeQuery<HabitStats[]>(`
          SELECT 
            COUNT(*) as total_habits,
            AVG(consistency_score) as avg_consistency,
            AVG(streak_current) as avg_streak,
            MAX(streak_longest) as max_streak
          FROM habits 
          WHERE created_at BETWEEN ? AND ?
          AND deleted_at IS NULL
        `, [startDate, endDate]),

        // Time tracking statistics
        electron.executeQuery<TimeStats[]>(`
          SELECT 
            SUM(duration) as total_focus_time,
            AVG(duration) as avg_session_length,
            COUNT(DISTINCT DATE(start_time)) as days_with_focus
          FROM time_blocks 
          WHERE start_time BETWEEN ? AND ?
          AND deleted_at IS NULL
        `, [startDate, endDate]),

        // Productivity trends
        electron.executeQuery<ProductivityTrend[]>(`
          SELECT 
            DATE(completed_at) as date,
            COUNT(*) as completed_tasks,
            SUM(estimated_time) as total_estimated_time,
            SUM(actual_time) as total_actual_time
          FROM tasks 
          WHERE status = 'completed'
          AND completed_at BETWEEN ? AND ?
          AND deleted_at IS NULL
          GROUP BY DATE(completed_at)
          ORDER BY date
        `, [startDate, endDate])
      ])

      return {
        taskStats: taskStats?.[0] || { total_tasks: 0, completed_tasks: 0, completion_rate: 0, avg_estimated_time: 0, avg_actual_time: 0 },
        goalStats: goalStats?.[0] || { total_goals: 0, avg_progress: 0, completed_goals: 0, on_time_rate: 0 },
        habitStats: habitStats?.[0] || { total_habits: 0, avg_consistency: 0, avg_streak: 0, max_streak: 0 },
        timeStats: timeStats?.[0] || { total_focus_time: 0, avg_session_length: 0, days_with_focus: 0 },
        productivityTrends: productivityTrends || []
      }
    },
    enabled: electron.isReady,
  })

  const exportAnalytics = () => {
    // Export analytics data as CSV or PDF
    console.log('Export analytics')
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
            </div>
            <div className="flex gap-2">
              {(['week', 'month', 'quarter', 'year'] as const).map(range => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={category} onValueChange={(v) => setCategory(v as 'all' | 'tasks' | 'goals' | 'habits' | 'time')}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1">
            <Target className="mr-2 h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex-1">
            <TrendingUp className="mr-2 h-4 w-4" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="habits" className="flex-1">
            <Calendar className="mr-2 h-4 w-4" />
            Habits
          </TabsTrigger>
          <TabsTrigger value="time" className="flex-1">
            <LineChart className="mr-2 h-4 w-4" />
            Time
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="all" className="mt-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">78%</div>
                <p className="text-xs text-muted-foreground">
                  +5% from last period
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
                <LineChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((analyticsData?.timeStats?.total_focus_time || 0) / 60)}h
                </div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData?.timeStats?.days_with_focus || 0} active days
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(analyticsData?.taskStats?.completion_rate || 0)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData?.taskStats?.completed_tasks || 0} of {analyticsData?.taskStats?.total_tasks || 0} tasks
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Habit Consistency</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(analyticsData?.habitStats?.avg_consistency || 0)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg streak: {Math.round(analyticsData?.habitStats?.avg_streak || 0)} days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Progress Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ProgressChart days={timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Pie chart component would go here */}
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <PieChart className="h-12 w-12" />
                  <p>Category distribution chart</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Insights & Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Productivity Peak</h3>
                </div>
                <p className="text-sm">
                  You're most productive on Tuesday mornings. Consider scheduling important tasks during this time.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-status-completed/10 border border-status-completed/10">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-status-completed" />
                  <h3 className="font-semibold">Goal Progress</h3>
                </div>
                <p className="text-sm">
                  You're making good progress on your goals. Keep up the momentum with consistent weekly reviews.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-category-learning/10 border border-category-learning/10">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-category-learning" />
                  <h3 className="font-semibold">Habit Consistency</h3>
                </div>
                <p className="text-sm">
                  Your morning routine has a 94% completion rate. This consistency is building strong momentum.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs would have similar structure with specific analytics */}
        <TabsContent value="tasks" className="mt-6">
          {/* Task-specific analytics */}
        </TabsContent>
        
        <TabsContent value="goals" className="mt-6">
          {/* Goal-specific analytics */}
        </TabsContent>
        
        <TabsContent value="habits" className="mt-6">
          {/* Habit-specific analytics */}
        </TabsContent>
        
        <TabsContent value="time" className="mt-6">
          {/* Time-tracking analytics */}
        </TabsContent>
      </Tabs>
    </div>
  )
}