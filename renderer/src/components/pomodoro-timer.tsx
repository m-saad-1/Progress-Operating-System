import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Pause, RotateCcw, Coffee, BookOpen, Volume2, VolumeX } from 'lucide-react'
import {
  DEFAULT_LONG_BREAK_DURATION_MS,
  DEFAULT_POMODORO_DURATION_MS,
  DEFAULT_SHORT_BREAK_DURATION_MS,
  TimerMode,
  TimerAlarmSound,
} from '@/store'
import { formatTimeFromMs, useSharedTimer } from '@/hooks/use-shared-timer'

const CircularProgress = ({ progress, timeLeft, mode }: { progress: number; timeLeft: string; mode: TimerMode }) => {
  const radius = 90;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          className="text-secondary"
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress circle */}
        <circle
          className="text-primary transition-all duration-300 ease-linear"
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tracking-tighter">{timeLeft}</span>
        <span className="text-sm uppercase tracking-widest text-muted-foreground">{mode === 'pomodoro' ? 'Focus' : 'Break'}</span>
      </div>
    </div>
  );
};


export function PomodoroTimer() {
  const [mode, setMode] = useState<TimerMode>('pomodoro')
  const [animationKey, setAnimationKey] = useState(0)

  const {
    timerMode,
    timerRunning,
    timeLeftMs,
    progress,
    soundEnabled,
    timerAlarmSound,
    alarmOptions,
    previewAlarm,
    setSoundEnabled,
    setTimerAlarmSound,
    startTimer,
    stopTimer,
    resetTimer,
  } = useSharedTimer()

  const timeSettingsMs = useMemo(
    () => ({
      pomodoro: DEFAULT_POMODORO_DURATION_MS,
      shortBreak: DEFAULT_SHORT_BREAK_DURATION_MS,
      longBreak: DEFAULT_LONG_BREAK_DURATION_MS,
    }),
    []
  ) as Record<string, number>

  const isActiveMode = timerMode === mode
  const currentDurationMs = timeSettingsMs[mode]
  const displayedTimeLeft = isActiveMode ? timeLeftMs : currentDurationMs
  const displayedProgress = isActiveMode ? progress : 0

  // Keep Focus as the default when opening the Time tab.
  // Only sync external timer mode while a timer is actively running.
  useEffect(() => {
    if (!timerRunning || !timerMode || timerMode === 'custom') return
    setMode(timerMode)
  }, [timerMode, timerRunning])

  const handleToggle = () => {
    if (isActiveMode && timerRunning) {
      stopTimer()
      return
    }

    startTimer(mode, currentDurationMs)
    setAnimationKey((prev) => prev + 1)
  }

  const handleReset = () => {
    resetTimer(currentDurationMs)
    setAnimationKey((prev) => prev + 1)
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Pomodoro Timer</CardTitle>
            <CardDescription>Focus, take a break, repeat.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={soundEnabled ? 'Disable timer alarm' : 'Enable timer alarm'}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Alarm enabled' : 'Alarm disabled'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            <Select
              value={timerAlarmSound}
              onValueChange={(value) => {
                const selectedSound = value as TimerAlarmSound
                setTimerAlarmSound(selectedSound)
                previewAlarm(selectedSound, soundEnabled)
              }}
            >
              <SelectTrigger className="h-8 w-36 bg-secondary/50 border-transparent">
                <SelectValue placeholder="Alarm" />
              </SelectTrigger>
              <SelectContent>
                {alarmOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col items-center justify-center space-y-6">
        <Tabs value={mode} onValueChange={(value) => setMode(value as TimerMode)} className="w-full max-w-sm">
          <TabsList className="grid w-full grid-cols-3 bg-secondary/30 dark:bg-secondary/20 p-1 h-12 border-transparent">
            <TabsTrigger value="pomodoro"><BookOpen className="mr-1 h-4 w-4" />Focus</TabsTrigger>
            <TabsTrigger value="shortBreak"><Coffee className="mr-1 h-4 w-4" />Short Break</TabsTrigger>
            <TabsTrigger value="longBreak"><Coffee className="mr-1 h-4 w-4" />Long Break</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="my-6">
          <CircularProgress
            key={animationKey}
            progress={displayedProgress}
            timeLeft={formatTimeFromMs(displayedTimeLeft)}
            mode={mode}
          />
        </div>

        <div className="flex w-full max-w-xs items-center justify-center space-x-4">
          <Button onClick={handleToggle} size="lg" className="w-40 text-lg">
            {isActiveMode && timerRunning ? (
              <Pause className="mr-2 h-5 w-5" />
            ) : (
              <Play className="mr-2 h-5 w-5" />
            )}
            {isActiveMode && timerRunning ? 'Pause' : 'Start'}
          </Button>
          <Button
            onClick={handleReset}
            variant="secondary"
            size="lg"
            aria-label="Reset Timer"
            className="bg-secondary/80 hover:bg-secondary border-transparent shadow-none hover:shadow-none"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

