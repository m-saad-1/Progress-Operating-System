import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  Play, 
  StopCircle,
  Timer,
  Calendar,
  Target,
  Zap,
  Coffee,
  Sunrise,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { format, startOfDay, startOfWeek, endOfWeek, addWeeks, isSameWeek } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useElectron } from '@/hooks/use-electron'
import { PomodoroTimer } from '@/components/pomodoro-timer'
import { useSharedTimer, formatTimeFromMs } from '@/hooks/use-shared-timer'
import { DEFAULT_CUSTOM_DURATION_MS, DEFAULT_SHORT_BREAK_DURATION_MS } from '@/store'
import { cn } from '@/lib/utils'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

const DAILY_TARGET_HOURS = 6
const DAILY_TARGET_MINUTES = DAILY_TARGET_HOURS * 60
const PRODUCTIVE_TIME_FILTER_SQL = `
          AND (
            notes IS NULL
            OR (
              notes NOT LIKE 'shortBreak session%'
              AND notes NOT LIKE 'longBreak session%'
            )
          )
`

const TIME_TIPS_SECTIONS = [
  {
    title: 'What Counts Toward Productivity',
    points: [
      'Only focus sessions (Pomodoro focus) and custom timer sessions are counted in productivity and analytics.',
      'Break sessions are intentionally excluded so metrics represent active output time.',
      'When reviewing trends, interpret totals as focused work effort rather than total app-open time.',
    ],
  },
  {
    title: 'Effective Focus Practices',
    points: [
      'Start each session with one concrete objective so completion is measurable.',
      'Use custom durations for deep work blocks and Pomodoro for cadence-based execution.',
      'Stop and reset intentionally between sessions to keep logs accurate and avoid inflated carry-over.',
    ],
  },
  {
    title: 'Time Management Recommendations',
    points: [
      'Plan high-cognitive work during your peak energy window and schedule shallow tasks later.',
      'Use weekly distribution to rebalance effort across days before burnout builds up.',
      'Review missed focus targets and adjust next-day scope instead of forcing catch-up marathons.',
    ],
  },
] as const

/** Format seconds into Xh Ym */
function formatSeconds(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0h 0m'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

/** Format seconds into Xh */
function formatSecondsShort(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0h'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export default function Time() {
  const electron = useElectron()
  const {
    timerMode,
    timerRunning,
    timeLeftMs,
    elapsedMs,
    customDurationMs,
    startTimer: startSharedTimer,
    stopTimer: stopSharedTimer,
    resetTimer: resetSharedTimer,
    setCustomDurationMs,
  } = useSharedTimer()

  const currentCustomDurationMs = customDurationMs || DEFAULT_CUSTOM_DURATION_MS
  const displayedCustomTimeMs = timerMode === 'custom' ? timeLeftMs : currentCustomDurationMs
  const isRunning = timerRunning
  const isProductiveTimerMode = timerMode === 'pomodoro' || timerMode === 'custom'

  // Week navigation state for Weekly Distribution
  const [weekOffset, setWeekOffset] = useState(0)
  const selectedWeekStart = useMemo(() => {
    const base = weekOffset === 0 ? new Date() : addWeeks(new Date(), weekOffset)
    return startOfWeek(base, { weekStartsOn: 1 })
  }, [weekOffset])
  const selectedWeekEnd = useMemo(() => endOfWeek(selectedWeekStart, { weekStartsOn: 1 }), [selectedWeekStart])
  const isCurrentWeek = isSameWeek(selectedWeekStart, new Date(), { weekStartsOn: 1 })

  // ==========================================
  // DATA FETCHING - time_blocks table
  // ==========================================
  const { data: timeData } = useQuery({
    queryKey: ['time-tracking-core'],
    queryFn: async () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const weekStart = startOfWeek(today, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

      const [todayStats, yesterdayStats, weeklyTotal] = await Promise.all([
        // Today's time tracking
        electron.executeQuery(`
          SELECT 
            COALESCE(SUM(duration), 0) as total_time,
            COUNT(*) as total_sessions,
            COALESCE(SUM(CASE WHEN notes LIKE '%(complete)%' THEN 1 ELSE 0 END), 0) as completed_sessions
          FROM time_blocks 
          WHERE DATE(start_time, 'localtime') = DATE(?, 'localtime')
          AND deleted_at IS NULL
          ${PRODUCTIVE_TIME_FILTER_SQL}
        `, [
          startOfDay(today).toISOString()
        ]),

        // Yesterday's time tracking
        electron.executeQuery(`
          SELECT 
            COALESCE(SUM(duration), 0) as total_time,
            COUNT(*) as total_sessions,
            COALESCE(SUM(CASE WHEN notes LIKE '%(complete)%' THEN 1 ELSE 0 END), 0) as completed_sessions
          FROM time_blocks 
          WHERE DATE(start_time, 'localtime') = DATE(?, 'localtime')
          AND deleted_at IS NULL
          ${PRODUCTIVE_TIME_FILTER_SQL}
        `, [
          startOfDay(yesterday).toISOString()
        ]),

        // Weekly total
        electron.executeQuery(`
          SELECT 
            COALESCE(SUM(duration), 0) as total_time,
            COUNT(*) as total_sessions,
            COALESCE(SUM(CASE WHEN notes LIKE '%(complete)%' THEN 1 ELSE 0 END), 0) as completed_sessions
          FROM time_blocks 
          WHERE DATE(start_time, 'localtime') BETWEEN DATE(?, 'localtime') AND DATE(?, 'localtime')
          AND deleted_at IS NULL
          ${PRODUCTIVE_TIME_FILTER_SQL}
        `, [
          weekStart.toISOString(),
          weekEnd.toISOString()
        ]),
      ])

      return {
        today: Array.isArray(todayStats) ? todayStats[0] : { total_time: 0, total_sessions: 0, completed_sessions: 0 },
        yesterday: Array.isArray(yesterdayStats) ? yesterdayStats[0] : { total_time: 0, total_sessions: 0, completed_sessions: 0 },
        weekly: Array.isArray(weeklyTotal) ? weeklyTotal[0] : { total_time: 0, total_sessions: 0, completed_sessions: 0 },
      }
    },
    enabled: electron.isReady,
    refetchInterval: 30000, // Refresh every 30s for near-real-time display
  })

  // Weekly distribution query (separate for week navigation)
  const { data: weeklyDistribution } = useQuery({
    queryKey: ['time-weekly-distribution', weekOffset],
    queryFn: async () => {
      const result = await electron.executeQuery(`
        SELECT 
          DATE(start_time, 'localtime') as date,
          COALESCE(SUM(duration), 0) as daily_total,
          COUNT(*) as daily_sessions
        FROM time_blocks 
        WHERE DATE(start_time, 'localtime') BETWEEN DATE(?, 'localtime') AND DATE(?, 'localtime')
        AND deleted_at IS NULL
        ${PRODUCTIVE_TIME_FILTER_SQL}
        GROUP BY DATE(start_time, 'localtime')
        ORDER BY date ASC
      `, [
        selectedWeekStart.toISOString(),
        selectedWeekEnd.toISOString()
      ])
      return Array.isArray(result) ? result : []
    },
    enabled: electron.isReady,
  })

  // Build full 7-day array for selected week
  const weekDays = useMemo(() => {
    const days: Array<{ date: string; dayName: string; daily_total: number; daily_sessions: number }> = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(selectedWeekStart)
      d.setDate(d.getDate() + i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const found = weeklyDistribution?.find((w: any) => w.date === dateStr)
      days.push({
        date: dateStr,
        dayName: format(d, 'EEEE'),
        daily_total: found?.daily_total || 0,
        daily_sessions: found?.daily_sessions || 0,
      })
    }
    return days
  }, [weeklyDistribution, selectedWeekStart])

  // ==========================================
  // LIVE TODAY FOCUS (including running timer)
  // ==========================================
  const liveTodaySeconds = useMemo(() => {
    const dbSeconds = timeData?.today?.total_time || 0
    // Add currently running timer elapsed time (in seconds)
    if (isRunning && isProductiveTimerMode && elapsedMs > 0) {
      return dbSeconds + Math.floor(elapsedMs / 1000)
    }
    return dbSeconds
  }, [timeData?.today?.total_time, isRunning, elapsedMs, isProductiveTimerMode])

  const liveElapsedSeconds = useMemo(() => {
    if (!isRunning || !isProductiveTimerMode || elapsedMs <= 0) return 0
    return Math.floor(elapsedMs / 1000)
  }, [elapsedMs, isRunning, isProductiveTimerMode])

  const liveWeeklySeconds = useMemo(() => {
    const dbWeeklySeconds = timeData?.weekly?.total_time || 0
    return dbWeeklySeconds + liveElapsedSeconds
  }, [timeData?.weekly?.total_time, liveElapsedSeconds])

  const liveWeekDays = useMemo(() => {
    if (liveElapsedSeconds <= 0) return weekDays
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    return weekDays.map((day) => {
      if (day.date !== todayKey) return day
      return {
        ...day,
        daily_total: day.daily_total + liveElapsedSeconds,
      }
    })
  }, [liveElapsedSeconds, weekDays])

  const productivityPercent = useMemo(() => {
    const todayMinutes = liveTodaySeconds / 60
    return Math.min(Math.round((todayMinutes / DAILY_TARGET_MINUTES) * 100), 100)
  }, [liveTodaySeconds])

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleStartCustom = () => startSharedTimer('custom', currentCustomDurationMs)
  const handleStartBreak = () => startSharedTimer('shortBreak', DEFAULT_SHORT_BREAK_DURATION_MS)
  const handleResetCustom = useCallback(() => {
    resetSharedTimer(currentCustomDurationMs)
  }, [currentCustomDurationMs, resetSharedTimer])
  const handleStop = useCallback(() => {
    stopSharedTimer()
  }, [stopSharedTimer])

  const handleQuickCustomStart = (minutes: number) => {
    const durationMs = minutes * 60 * 1000
    setCustomDurationMs(durationMs)
    startSharedTimer('custom', durationMs)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-3xl font-bold">Time Management</h1>
            <ContextTipsDialog
              title="Time Tab Tips"
              description="How productivity time is counted and how to run higher-quality focus sessions."
              sections={TIME_TIPS_SECTIONS}
              triggerLabel="Open time tab tips"
            />
          </div>
          <p className="text-muted-foreground">
            Track and optimize your time usage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isRunning ? "default" : "secondary"} className={cn(
            isRunning
              ? "bg-status-active text-white border-status-active/70 shadow-sm"
              : "bg-secondary text-secondary-foreground"
          )}>
            {isRunning && <span className="mr-1.5 h-2 w-2 rounded-full bg-white/95 animate-pulse" />}
            {isRunning ? 'ACTIVE' : 'IDLE'}
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
                  {formatTimeFromMs(displayedCustomTimeMs)}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="120"
                    value={Math.floor(currentCustomDurationMs / 60000)}
                    onChange={(e) => {
                      const durationMs = parseInt(e.target.value, 10) * 60 * 1000
                      setCustomDurationMs(durationMs)
                      if (!isRunning && (!timerMode || timerMode === 'custom')) {
                        resetSharedTimer(durationMs)
                      }
                    }}
                    className="w-48 custom-range disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isRunning}
                  />
                  <span className="text-sm w-12">
                    {Math.floor(currentCustomDurationMs / 60000)} min
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                {isRunning ? (
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    className="flex-1 border-2 border-destructive/60 font-semibold tracking-wide"
                  >
                    <StopCircle className="mr-2 h-4 w-4" />
                    STOP
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStartCustom}
                    className="flex-1"
                    disabled={isRunning && timerMode !== 'custom'}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Custom Timer
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleResetCustom}
                  className="bg-secondary/80 hover:bg-secondary border-transparent"
                >
                  <Timer className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-secondary/30 dark:bg-secondary/20 p-1 border border-transparent">
                <Button
                  variant="secondary"
                  size="sm"
                  className="border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  onClick={() => {
                    const durationMs = 25 * 60 * 1000
                    setCustomDurationMs(durationMs)
                    if (!isRunning) resetSharedTimer(durationMs)
                  }}
                >
                  25 min
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  onClick={() => {
                    const durationMs = 50 * 60 * 1000
                    setCustomDurationMs(durationMs)
                    if (!isRunning) resetSharedTimer(durationMs)
                  }}
                >
                  50 min
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  onClick={() => {
                    const durationMs = 90 * 60 * 1000
                    setCustomDurationMs(durationMs)
                    if (!isRunning) resetSharedTimer(durationMs)
                  }}
                >
                  90 min
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Core Time Statistics: Today Focus (live), Yesterday, Weekly, Productivity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Focus — live counter including running timer */}
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today Focus</CardTitle>
            <div className="flex items-center gap-1">
              {isRunning && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
              <Sunrise className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatSeconds(liveTodaySeconds)}
            </div>
            <Progress value={productivityPercent} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {timeData?.today?.total_sessions || 0} sessions • {timeData?.today?.completed_sessions || 0} completed {isRunning ? '(timer running)' : ''}
            </p>
          </CardContent>
        </Card>
        
        {/* Yesterday */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yesterday</CardTitle>
            <Moon className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatSecondsShort(timeData?.yesterday?.total_time || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeData?.yesterday?.total_sessions || 0} sessions
            </p>
          </CardContent>
        </Card>
        
        {/* Weekly */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatSecondsShort(liveWeeklySeconds)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {timeData?.weekly?.total_sessions || 0} sessions • {timeData?.weekly?.completed_sessions || 0} completed this week
            </p>
          </CardContent>
        </Card>
        
        {/* Productivity — based on 6h daily target, live */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productivity</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productivityPercent}%
            </div>
            <Progress value={productivityPercent} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              of daily target ({DAILY_TARGET_HOURS}h)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Time Distribution with navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Weekly Time Distribution</CardTitle>
              <CardDescription>
                {format(selectedWeekStart, 'MMM d')} – {format(selectedWeekEnd, 'MMM d, yyyy')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset(w => w - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs px-2"
                disabled={isCurrentWeek}
                onClick={() => setWeekOffset(0)}
              >
                This Week
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isCurrentWeek}
                onClick={() => setWeekOffset(w => w + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {liveWeekDays.some(d => d.daily_total > 0) ? (
            <div className="space-y-3">
              {liveWeekDays.map((day) => {
                const targetSeconds = DAILY_TARGET_HOURS * 3600
                const pct = Math.min((day.daily_total / targetSeconds) * 100, 100)
                return (
                  <div key={day.date} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium w-24">{day.dayName}</span>
                      <span className="text-sm font-medium">
                        {formatSeconds(day.daily_total)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{day.daily_sessions} session{day.daily_sessions !== 1 ? 's' : ''}</span>
                      <span>{Math.round(pct)}% of target</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-semibold mb-1">No time tracked this week</h3>
              <p className="text-sm text-muted-foreground">
                Start a focus session to track your time
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Time Blocks — colorful and functional */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Time Blocks</CardTitle>
          <CardDescription>
            Tap to instantly start a focus session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="ghost"
              className="h-24 flex-col border-0 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm"
              onClick={() => handleQuickCustomStart(20)}
              disabled={isRunning}
            >
              <Target className="h-7 w-7 mb-2" />
              <span className="font-bold text-base">20 min</span>
              <span className="text-xs opacity-80">Deep Work</span>
            </Button>
            
            <Button
              variant="ghost"
              className="h-24 flex-col border-0 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm"
              onClick={handleStartBreak}
              disabled={isRunning}
            >
              <Coffee className="h-7 w-7 mb-2" />
              <span className="font-bold text-base">5 min</span>
              <span className="text-xs opacity-80">Short Break</span>
            </Button>
            
            <Button
              variant="ghost"
              className="h-24 flex-col border-0 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm"
              onClick={() => handleQuickCustomStart(90)}
              disabled={isRunning}
            >
              <Sunrise className="h-7 w-7 mb-2" />
              <span className="font-bold text-base">90 min</span>
              <span className="text-xs opacity-80">Extended Focus</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}