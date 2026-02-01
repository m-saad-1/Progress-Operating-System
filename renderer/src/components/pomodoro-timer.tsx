import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Pause, RotateCcw, Coffee, BookOpen } from 'lucide-react'

const POMODORO_TIME = 25 * 60;
const SHORT_BREAK_TIME = 5 * 60;
const LONG_BREAK_TIME = 15 * 60;

type TimerMode = 'pomodoro' | 'shortBreak' | 'longBreak';

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
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(POMODORO_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [key, setKey] = useState(0); // To force re-render of timer animation

  const timeSettings = useMemo(() => ({
    pomodoro: POMODORO_TIME,
    shortBreak: SHORT_BREAK_TIME,
    longBreak: LONG_BREAK_TIME,
  }), []);

  useEffect(() => {
    setIsRunning(false);
    setTimeLeft(timeSettings[mode]);
    setKey(prev => prev + 1); // Reset animation
  }, [mode, timeSettings]);

  useEffect(() => {
    if (!isRunning) return;

    if (timeLeft === 0) {
      setIsRunning(false);
      // TODO: Add notification and auto-switch logic
      console.log(`${mode} timer complete!`);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  const toggleTimer = () => {
    setIsRunning(prev => !prev);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(timeSettings[mode]);
    setKey(prev => prev + 1); // Reset animation
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((timeSettings[mode] - timeLeft) / timeSettings[mode]) * 100;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Pomodoro Timer</CardTitle>
        <CardDescription>Focus, take a break, repeat.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col items-center justify-center space-y-6">
        <Tabs value={mode} onValueChange={(value) => setMode(value as TimerMode)} className="w-full max-w-sm">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pomodoro"><BookOpen className="mr-1 h-4 w-4" />Focus</TabsTrigger>
            <TabsTrigger value="shortBreak"><Coffee className="mr-1 h-4 w-4" />Short Break</TabsTrigger>
            <TabsTrigger value="longBreak"><Coffee className="mr-1 h-4 w-4" />Long Break</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="my-6">
          <CircularProgress key={key} progress={progress} timeLeft={formatTime(timeLeft)} mode={mode} />
        </div>

        <div className="flex w-full max-w-xs items-center justify-center space-x-4">
          <Button onClick={toggleTimer} size="lg" className="w-40 text-lg">
            {isRunning ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {isRunning ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={resetTimer} variant="secondary" size="lg" aria-label="Reset Timer" className="bg-secondary/80 hover:bg-secondary border-transparent shadow-none hover:shadow-none">
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

