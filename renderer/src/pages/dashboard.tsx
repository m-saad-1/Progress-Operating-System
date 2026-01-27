import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Calendar, 
  CheckCircle, 
  TrendingUp, 
  Clock, 
  Target, 
  Star,
  BarChart3,
  AlertCircle,
  Zap,
  CalendarDays,
  ArrowUpRight
} from 'lucide-react'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { useStore } from '@/store'
import { HabitTracker } from '@/components/habit-tracker'
import { TaskList } from '@/components/task-list'
import { ProgressChart } from '@/components/progress-chart'
import { PomodoroTimer } from '@/components/pomodoro-timer'
import { QuickActions } from '@/components/quick-actions'
import { cn } from '@/lib/utils'

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string; // ISO string
  status: 'pending' | 'completed' | 'in-progress';
  priority: 'critical' | 'high' | 'medium' | 'low';
  deleted_at?: string; // ISO string
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  category: string;
  progress: number;
  status: 'active' | 'completed' | 'archived';
  priority: 'critical' | 'high' | 'medium' | 'low';
  target_date?: string; // ISO string
  completed_at?: string; // ISO string
  deleted_at?: string; // ISO string
}

interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  schedule?: string; // JSON string for weekly/monthly
  consistency_score: number;
  streak_current: number;
  streak_longest: number;
  today_completed: 0 | 1 | null;
  deleted_at?: string; // ISO string
}

interface DashboardStats {
  completed_today: number;
  completed_week: number;
  avg_goal_progress: number;
  avg_consistency: number;
  overdue_tasks: number;
  focus_time_today: number;
}

interface Achievement {
  type: 'goal_completed' | 'streak_achieved';
  title: string;
  timestamp: string; // ISO string
}

interface DashboardData {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  stats: DashboardStats;
  achievements: Achievement[];
}

export default function Dashboard() {
  const electron = useElectron()
  const { toast, success, error: toastError } = useToaster()
  const store = useStore()
  const today = new Date()
  
  const [timeOfDay, setTimeOfDay] = useState('')
  const [greeting, setGreeting] = useState('')

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

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      try {
        // Fetch today's tasks
        const tasks = await electron.executeQuery<Task[]>(`
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
        const goals = await electron.executeQuery<Goal[]>(`
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

        // Fetch today's habits
        const habits = await electron.executeQuery<Habit[]>(`
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

        // Fetch dashboard statistics
        const stats = await electron.executeQuery<DashboardStats[]>(`
          SELECT 
            -- Today's stats
            (SELECT COUNT(*) FROM tasks 
             WHERE status = 'completed' 
             AND completed_at BETWEEN ? AND ?) as completed_today,
            
            -- Weekly stats
            (SELECT COUNT(*) FROM tasks 
             WHERE status = 'completed' 
             AND completed_at BETWEEN ? AND ?) as completed_week,
            
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
             AND deleted_at IS NULL) as overdue_tasks,
            
            -- Time tracking
            (SELECT SUM(duration) FROM time_blocks 
             WHERE start_time BETWEEN ? AND ?) as focus_time_today
        `, [
          startOfDay(today).toISOString(), endOfDay(today).toISOString(),
          startOfDay(subDays(today, 7)).toISOString(), endOfDay(today).toISOString(),
          startOfDay(today).toISOString(),
          startOfDay(today).toISOString(), endOfDay(today).toISOString()
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

        return { 
          tasks: Array.isArray(tasks) ? tasks : [], 
          goals: Array.isArray(goals) ? goals : [], 
          habits: Array.isArray(habits) ? habits : [], 
          stats: Array.isArray(stats) ? stats[0] || {} : {}, 
          achievements: Array.isArray(achievements) ? achievements : [] 
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        toastError('Failed to fetch dashboard data')
        throw error
      }
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-status-completed" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.stats?.completed_today || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              tasks completed today
            </p>
            <Progress 
              value={dashboardData?.stats?.completed_today ? 
                Math.min((dashboardData.stats.completed_today / 10) * 100, 100) : 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>
        
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goal Progress</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(dashboardData?.stats?.avg_goal_progress || 0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              average across all goals
            </p>
            <Progress 
              value={dashboardData?.stats?.avg_goal_progress || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>
        
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Habit Consistency</CardTitle>
            <TrendingUp className="h-4 w-4 text-category-health" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(dashboardData?.stats?.avg_consistency || 0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              daily habit completion rate
            </p>
            <Progress 
              value={dashboardData?.stats?.avg_consistency || 0} 
              variant="success"
              className="mt-2"
            />
          </CardContent>
        </Card>
        
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
            <Clock className="h-4 w-4 text-category-learning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((dashboardData?.stats?.focus_time_today || 0) / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(((dashboardData?.stats?.focus_time_today || 0) / 60) / 8 * 100)}% of daily target
            </p>
            <Progress 
              value={Math.min(((dashboardData?.stats?.focus_time_today || 0) / 60) / 8 * 100, 100)} 
              variant="warning"
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Today's Tasks</CardTitle>
                <Badge variant={(dashboardData?.stats?.overdue_tasks || 0) > 0 ? "destructive" : "secondary"}>
                  {dashboardData?.stats?.overdue_tasks || 0} overdue
                </Badge>
              </div>
              <CardDescription>
                Your tasks for {format(today, 'MMMM d')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (dashboardData?.tasks?.length || 0) > 0 ? (
                <TaskList 
                  tasks={(dashboardData?.tasks || []) as any} 
                  showPriority={true}
                  showActions={true}
                  compact={true}
                  maxItems={5}
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

          {/* Progress Charts */}
          <Card>
            <CardHeader>
              <CardTitle>Progress Analytics</CardTitle>
              <CardDescription>
                Weekly performance overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProgressChart 
                days={7}
                showHabits={true}
                showTasks={true}
              />
            </CardContent>
          </Card>

          {/* Recent Achievements */}
          {(dashboardData?.achievements?.length || 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Achievements</CardTitle>
                <CardDescription>
                  Celebrate your recent successes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData!.achievements.map((achievement: Achievement, index: number) => (
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
                            <Star className="h-5 w-5" />
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
          {/* Today's Habits */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Habits</CardTitle>
              <CardDescription>
                Build consistency day by day
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (dashboardData?.habits?.length || 0) > 0 ? (
                <HabitTracker 
                  habits={dashboardData?.habits || []}
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
              <CardTitle>Active Goals</CardTitle>
              <CardDescription>
                Your current focus areas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (dashboardData?.goals?.length || 0) > 0 ? (
                dashboardData!.goals.slice(0, 3).map((goal: Goal) => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{goal.title}</span>
                      <span className="text-sm font-bold">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} />
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
              {(dashboardData?.goals?.length || 0) > 3 && (
                <Button variant="ghost" size="sm" className="w-full">
                  View all goals ({dashboardData!.goals.length})
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Weekly Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Summary</CardTitle>
              <CardDescription>
                {format(subDays(today, 6), 'MMM d')} - {format(today, 'MMM d')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tasks Completed</span>
                  <span className="font-semibold">{dashboardData?.stats?.completed_week || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Focus Sessions</span>
                  <span className="font-semibold">
                    {Math.round((dashboardData?.stats?.focus_time_today || 0) / 25) || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Habit Streaks</span>
                  <span className="font-semibold">
                    {Array.isArray(dashboardData?.habits) ? dashboardData.habits.filter((h: Habit) => h.streak_current >= 7).length : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Productivity Score</span>
                  <span className="font-semibold text-status-completed">
                    {Math.round(
                      ((dashboardData?.stats?.completed_week || 0) * 30 + 
                       (dashboardData?.stats?.avg_consistency || 0) * 40 + 
                       (dashboardData?.stats?.avg_goal_progress || 0) * 30) / 100
                    )}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center space-x-2 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Peak Productivity</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You're most productive on Tuesday mornings
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-status-completed/5 border border-status-completed/10">
                <div className="flex items-center space-x-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-status-completed" />
                  <span className="text-sm font-medium">Consistency Up</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Habit consistency increased 12% this week
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-category-learning/5 border border-category-learning/10">
                <div className="flex items-center space-x-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-category-learning" />
                  <span className="text-sm font-medium">Attention Needed</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.stats?.overdue_tasks || 0} tasks are overdue
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Time of Day Message */}
      <div className="text-center text-sm text-muted-foreground">
        Have a productive {timeOfDay}! Remember to take breaks and stay hydrated.
      </div>
    </div>
  )
}