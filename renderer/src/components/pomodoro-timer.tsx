import React, { useState, useEffect } from 'react'
import { Play, Pause, RotateCcw, Bell, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useToaster } from '@/hooks/use-toaster'

const POMODORO_TIME = 25 * 60 // 25 minutes in seconds
const SHORT_BREAK = 5 * 60 // 5 minutes in seconds
const LONG_BREAK = 15 * 60 // 15 minutes in seconds

export function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(POMODORO_TIME)
  const [isActive, setIsActive] = useState(false)
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus')
  const [cycles, setCycles] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [volume, setVolume] = useState(50)
  const { toast } = useToaster()

  const totalTime = mode === 'focus' ? POMODORO_TIME : 
                   mode === 'shortBreak' ? SHORT_BREAK : LONG_BREAK
  const progress = ((totalTime - timeLeft) / totalTime) * 100

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const playSound = () => {
    if (soundEnabled) {
      // Play notification sound
      const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3')
      audio.volume = volume / 100
      audio.play().catch((err) => {
        console.error('Failed to play sound:', err)
        // Fallback or silent fail
      })
    }
  }

  const handleComplete = () => {
    playSound()
    
    if (mode === 'focus') {
      const newCycles = cycles + 1
      setCycles(newCycles)
      
      if (newCycles % 4 === 0) {
        setMode('longBreak')
        setTimeLeft(LONG_BREAK)
        toast({
          title: 'Great work!',
          description: 'Time for a long break (15 minutes)',
          type: 'success',
        })
      } else {
        setMode('shortBreak')
        setTimeLeft(SHORT_BREAK)
        toast({
          title: 'Focus session complete!',
          description: 'Time for a short break (5 minutes)',
          type: 'success',
        })
      }
    } else {
      setMode('focus')
      setTimeLeft(POMODORO_TIME)
      toast({
        title: 'Break time over!',
        description: 'Ready for another focus session?',
        type: 'info',
      })
    }
    
    setIsActive(false)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1)
      }, 1000)
    } else if (isActive && timeLeft === 0) {
      handleComplete()
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, timeLeft])

  const toggleTimer = () => {
    setIsActive(!isActive)
  }

  const resetTimer = () => {
    setIsActive(false)
    setTimeLeft(mode === 'focus' ? POMODORO_TIME : 
               mode === 'shortBreak' ? SHORT_BREAK : LONG_BREAK)
  }

  const skipToBreak = () => {
    if (mode === 'focus') {
      setMode('shortBreak')
      setTimeLeft(SHORT_BREAK)
    } else {
      setMode('focus')
      setTimeLeft(POMODORO_TIME)
    }
    setIsActive(false)
  }

  const getModeColor = () => {
    switch (mode) {
      case 'focus':
        return 'bg-primary/10 text-primary border-primary/20'
      case 'shortBreak':
        return 'bg-status-completed/10 text-status-completed border-status-completed/20'
      case 'longBreak':
        return 'bg-category-learning/10 text-category-learning border-category-learning/20'
    }
  }

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all duration-300",
      isActive ? "pomodoro-active" : "",
      getModeColor()
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Pomodoro Timer</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium px-2 py-1 rounded-md bg-background">
            Cycle: {cycles}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 w-8"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className="text-5xl font-bold mb-2 tracking-tight">
          {formatTime(timeLeft)}
        </div>
        <div className={cn(
          "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
          getModeColor()
        )}>
          {mode === 'focus' && 'Focus Time'}
          {mode === 'shortBreak' && 'Short Break'}
          {mode === 'longBreak' && 'Long Break'}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0:00</span>
          <span>{mode === 'focus' ? '25:00' : mode === 'shortBreak' ? '5:00' : '15:00'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant={isActive ? "destructive" : "default"}
            size="sm"
            onClick={toggleTimer}
            className="min-w-20"
          >
            {isActive ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start
              </>
            )}
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={resetTimer}
                  className="h-9 w-9"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset Timer</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={skipToBreak}
        >
          {mode === 'focus' ? 'Take Break' : 'Skip to Focus'}
        </Button>
      </div>

      {/* Volume Control */}
      {soundEnabled && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Volume</span>
            <span className="text-sm font-medium">{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            onValueChange={([value]) => setVolume(value)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 pt-4 border-t">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Focus</div>
            <div className="font-bold">{cycles * 25} min</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Breaks</div>
            <div className="font-bold">{Math.floor(cycles / 4) * 15 + (cycles % 4) * 5} min</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Efficiency</div>
            <div className="font-bold">92%</div>
          </div>
        </div>
      </div>
    </div>
  )
}