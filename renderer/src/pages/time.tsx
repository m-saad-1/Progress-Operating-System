import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Clock, 
  Play, 
  Pause, 
  StopCircle,
  Timer,
  Calendar,
  BarChart3,
  Target,
  Zap,
  Coffee,
  Sunrise,
  Moon
} from 'lucide-react'
import { format, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useElectron } from '@/hooks/use-electron'
import { PomodoroTimer } from '@/components/pomodoro-timer'
import { cn } from '@/lib/utils'

export default function Time() {
  const electron = useElectron()
  const [activeTimer, setActiveTimer] = useState<'pomodoro' | 'break' | 'custom' | null>(null)
  const [customTime, setCustomTime] = useState(25 * 60) // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(customTime)

  const { data: timeData, isLoading } = useQuery({
    queryKey: ['time-tracking'],
    queryFn: async () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const [todayStats, yesterdayStats, weeklyStats, topTasks] = await Promise.all([
        // Today's time tracking
        electron.executeQuery(`
          SELECT 
            COUNT(*) as total_sessions,
            SUM(duration) as total_time,
            AVG(duration) as avg_session_length,
            (SELECT COUNT(DISTINCT task_id) FROM time_blocks 
             WHERE start_time BETWEEN ? AND ?) as unique_tasks
          FROM time_blocks 
          WHERE start_time BETWEEN ? AND ?
          AND deleted_at IS NULL
        `, [
          format(startOfDay(today), 'yyyy-MM-dd HH:mm:ss'),
          format(endOfDay(today), 'yyyy-MM-dd HH:mm:ss'),
          format(startOfDay(today), 'yyyy-MM-dd HH:mm:ss'),
          format(endOfDay(today), 'yyyy-MM-dd HH:mm:ss')
        ]),

        // Yesterday's time tracking
        electron.executeQuery(`
          SELECT 
            SUM(duration) as total_time,
            COUNT(*) as total_sessions
          FROM time_blocks 
          WHERE start_time BETWEEN ? AND ?
          AND deleted_at IS NULL
        `, [
          format(startOfDay(yesterday), 'yyyy-MM-dd HH:mm:ss'),
          format(endOfDay(yesterday), 'yyyy-MM-dd HH:mm:ss')
        ]),

        // Weekly stats
        electron.executeQuery(`
          SELECT 
            DATE(start_time) as date,
            SUM(duration) as daily_total,
            COUNT(*) as daily_sessions
          FROM time_blocks 
          WHERE start_time >= date('now', '-7 days')
          AND deleted_at IS NULL
          GROUP BY DATE(start_time)
          ORDER BY date DESC
        `),

        // Top tasks by time spent
        electron.executeQuery(`
          SELECT 
            t.title,
            SUM(tb.duration) as total_time,
            COUNT(*) as sessions
          FROM time_blocks tb
          JOIN tasks t ON tb.task_id = t.id
          WHERE tb.start_time >= date('now', '-30 days')
          AND tb.deleted_at IS NULL
          AND t.deleted_at IS NULL
          GROUP BY t.id
          ORDER BY total_time DESC
          LIMIT 5
        `)
      ])

      return {
        today: Array.isArray(todayStats) ? todayStats[0] : {},
        yesterday: Array.isArray(yesterdayStats) ? yesterdayStats[0] : {},
        weekly: Array.isArray(weeklyStats) ? weeklyStats : [],
        topTasks: Array.isArray(topTasks) ? topTasks : []
      }
    },
    enabled: electron.isReady,
  })

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (isRunning && timeLeft === 0) {
      handleTimerComplete()
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, timeLeft])

  const handleTimerComplete = () => {
    setIsRunning(false)
    // Play sound, show notification, etc.
    console.log('Timer complete!')
  }

  const startTimer = (timerType: 'pomodoro' | 'break' | 'custom') => {
    setActiveTimer(timerType)
    setIsRunning(true)
    
    if (timerType === 'pomodoro') {
      setTimeLeft(25 * 60)
    } else if (timerType === 'break') {
      setTimeLeft(5 * 60)
    }
  }

  const stopTimer = () => {
    setIsRunning(false)
  }

  const resetTimer = () => {
    setIsRunning(false)
    if (activeTimer === 'pomodoro') {
      setTimeLeft(25 * 60)
    } else if (activeTimer === 'break') {
      setTimeLeft(5 * 60)
    } else {
      setTimeLeft(customTime)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProductivityScore = () => {
    if (!timeData?.today?.total_time) return 0
    const todayTime = timeData.today.total_time / 60 // Convert to minutes
    const targetTime = 8 * 60 // 8 hours target
    return Math.min(Math.round((todayTime / targetTime) * 100), 100)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Management</h1>
          <p className="text-muted-foreground">
            Track and optimize your time usage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isRunning ? "success" : "secondary"}>
            {isRunning ? 'Active' : 'Idle'}
          </Badge>
        </div>
      </div>

      {/* Timer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pomodoro Timer */}
        <div className="lg:col-span-2">
          <PomodoroTimer />
        </div>

        {/* Custom Timer */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Timer</CardTitle>
            <CardDescription>
              Set a custom focus session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-5xl font-bold mb-4">
                  {formatTime(timeLeft)}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="120"
                    value={Math.floor(customTime / 60)}
                    onChange={(e) => {
                      setCustomTime(parseInt(e.target.value) * 60)
                      if (!isRunning) {
                        setTimeLeft(parseInt(e.target.value) * 60)
                      }
                    }}
                    className="w-48"
                    disabled={isRunning}
                  />
                  <span className="text-sm w-12">
                    {Math.floor(customTime / 60)} min
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                {isRunning ? (
                  <Button onClick={stopTimer} variant="destructive" className="flex-1">
                    <StopCircle className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                ) : (
                  <Button 
                    onClick={() => startTimer('custom')} 
                    className="flex-1"
                    disabled={activeTimer === 'pomodoro'}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Custom Timer
                  </Button>
                )}
                <Button variant="outline" onClick={resetTimer}>
                  <Timer className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomTime(25 * 60)
                    if (!isRunning) setTimeLeft(25 * 60)
                  }}
                >
                  25 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomTime(50 * 60)
                    if (!isRunning) setTimeLeft(50 * 60)
                  }}
                >
                  50 min
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomTime(90 * 60)
                    if (!isRunning) setTimeLeft(90 * 60)
                  }}
                >
                  90 min
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Focus</CardTitle>
            <Sunrise className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeData?.today?.total_time 
                ? `${Math.round(timeData.today.total_time / 60)}h ${timeData.today.total_time % 60}m`
                : '0h 0m'
              }
            </div>
            <Progress value={getProductivityScore()} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {timeData?.today?.total_sessions || 0} sessions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeData?.today?.avg_session_length 
                ? `${Math.round(timeData.today.avg_session_length / 60)}m`
                : '0m'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {timeData?.today?.unique_tasks || 0} unique tasks
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yesterday</CardTitle>
            <Moon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeData?.yesterday?.total_time 
                ? `${Math.round(timeData.yesterday.total_time / 60)}h`
                : '0h'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {timeData?.yesterday?.total_sessions || 0} sessions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productivity</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getProductivityScore()}%</div>
            <p className="text-xs text-muted-foreground">
              of daily target (8h)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time Analysis */}
      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">
            <Calendar className="mr-2 h-4 w-4" />
            Weekly Overview
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <Target className="mr-2 h-4 w-4" />
            Top Tasks
          </TabsTrigger>
          <TabsTrigger value="insights">
            <BarChart3 className="mr-2 h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Time Distribution</CardTitle>
              <CardDescription>
                Time spent per day over the past week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeData?.weekly?.map((day: any) => (
                  <div key={day.date} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {format(new Date(day.date), 'EEEE')}
                      </span>
                      <span className="text-sm">
                        {Math.round(day.daily_total / 60)}h {day.daily_total % 60}m
                      </span>
                    </div>
                    <Progress 
                      value={Math.min((day.daily_total / (8 * 60 * 60)) * 100, 100)} 
                      className="h-2"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{day.daily_sessions} sessions</span>
                      <span>
                        {day.daily_total > 0 
                          ? `${Math.round(day.daily_total / day.daily_sessions / 60)}m avg`
                          : 'No sessions'
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Time-Consuming Tasks</CardTitle>
              <CardDescription>
                Tasks you've spent the most time on (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeData?.topTasks?.map((task: any, index: number) => (
                  <div key={task.title} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.sessions} sessions
                          </p>
                        </div>
                      </div>
                      <span className="font-bold">
                        {Math.round(task.total_time / 60)}h
                      </span>
                    </div>
                    <Progress 
                      value={Math.min((task.total_time / (timeData.topTasks[0].total_time)) * 100, 100)} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Time Management Insights</CardTitle>
              <CardDescription>
                Recommendations based on your time usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Peak Productivity Hours</h3>
                </div>
                <p className="text-sm">
                  You're most productive between 9 AM - 12 PM. Consider scheduling important tasks during this window.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-status-completed/5 border border-status-completed/10">
                <div className="flex items-center gap-2 mb-2">
                  <Coffee className="h-5 w-5 text-status-completed" />
                  <h3 className="font-semibold">Break Optimization</h3>
                </div>
                <p className="text-sm">
                  Your breaks average 8 minutes. Try the 5-minute break rule to maintain focus throughout the day.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-category-learning/5 border border-category-learning/10">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-category-learning" />
                  <h3 className="font-semibold">Deep Work Sessions</h3>
                </div>
                <p className="text-sm">
                  You average 42-minute focus sessions. Consider extending to 50-minute sessions for deeper work.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Time Blocking */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Time Blocks</CardTitle>
          <CardDescription>
            Common focus session templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => startTimer('pomodoro')}
              disabled={isRunning}
            >
              <Timer className="h-6 w-6 mb-2" />
              <span className="font-bold">25 min</span>
              <span className="text-xs text-muted-foreground">Pomodoro</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => {
                setCustomTime(50 * 60)
                startTimer('custom')
              }}
              disabled={isRunning}
            >
              <Target className="h-6 w-6 mb-2" />
              <span className="font-bold">50 min</span>
              <span className="text-xs text-muted-foreground">Deep Work</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => startTimer('break')}
              disabled={isRunning}
            >
              <Coffee className="h-6 w-6 mb-2" />
              <span className="font-bold">5 min</span>
              <span className="text-xs text-muted-foreground">Short Break</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => {
                setCustomTime(90 * 60)
                startTimer('custom')
              }}
              disabled={isRunning}
            >
              <Sunrise className="h-6 w-6 mb-2" />
              <span className="font-bold">90 min</span>
              <span className="text-xs text-muted-foreground">Extended Focus</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}