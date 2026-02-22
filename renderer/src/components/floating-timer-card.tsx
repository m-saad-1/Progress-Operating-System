import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Play, StopCircle, RotateCcw, Move, Timer as TimerIcon } from 'lucide-react'
import {
  formatTimeFromMs,
  getDefaultDurationForMode,
  timerPositions,
  useSharedTimer,
} from '@/hooks/use-shared-timer'
import { FloatingTimerPosition, TimerMode } from '@/store'

const positionClasses: Record<FloatingTimerPosition, string> = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
}

const modeLabels: Record<TimerMode, string> = {
  pomodoro: 'Pomodoro',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
  custom: 'Custom Timer',
}

export function FloatingTimerCard() {
  const {
    timerMode,
    timerRunning,
    timerDurationMs,
    timeLeftMs,
    progress,
    customDurationMs,
    floatingTimerPosition,
    startTimer,
    stopTimer,
    resetTimer,
    setFloatingTimerPosition,
  } = useSharedTimer()

  const shouldRender = timerMode !== null
  const nextPosition = useMemo(() => {
    if (!floatingTimerPosition) return timerPositions[0]
    const currentIndex = timerPositions.indexOf(floatingTimerPosition)
    return timerPositions[(currentIndex + 1) % timerPositions.length]
  }, [floatingTimerPosition])

  if (!shouldRender || !timerMode) return null

  const fallbackDuration = getDefaultDurationForMode(timerMode, customDurationMs)
  const targetDurationMs = timerDurationMs || fallbackDuration
  const displayedTime = timeLeftMs || targetDurationMs

  const handleToggle = () => {
    if (timerRunning) {
      stopTimer()
      return
    }
    startTimer(timerMode, targetDurationMs)
  }

  const handleReset = () => resetTimer(targetDurationMs)

  return (
    <div
      className={`pointer-events-auto fixed z-50 ${positionClasses[floatingTimerPosition]}`}
      aria-live="polite"
    >
      <Card className="w-72 shadow-lg border-primary/20 bg-background/95 backdrop-blur">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TimerIcon className="h-4 w-4" />
              <span>{modeLabels[timerMode]}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move timer card"
              onClick={() => setFloatingTimerPosition(nextPosition)}
              className="h-8 w-8"
            >
              <Move className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-3xl font-bold tracking-tight">
              {formatTimeFromMs(displayedTime)}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleToggle} size="icon">
                {timerRunning ? (
                  <StopCircle className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleReset}
                className="bg-secondary/80 hover:bg-secondary border-transparent"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>
    </div>
  )
}
