import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { database } from '@/lib/database'
import {
  useStore,
  TimerMode,
  TimerAlarmSound,
  FloatingTimerPosition,
  DEFAULT_CUSTOM_DURATION_MS,
  DEFAULT_LONG_BREAK_DURATION_MS,
  DEFAULT_POMODORO_DURATION_MS,
  DEFAULT_SHORT_BREAK_DURATION_MS,
} from '@/store'

const MS_IN_SECOND = 1000

export const TIMER_ALARM_OPTIONS: Array<{ value: TimerAlarmSound; label: string }> = [
  { value: 'classic', label: 'Classic' },
  { value: 'digital', label: 'Digital' },
  { value: 'bell', label: 'Bell' },
  { value: 'chime', label: 'Chime' },
  { value: 'soft', label: 'Soft' },
  { value: 'focus', label: 'Focus' },
  { value: 'crystal', label: 'Crystal' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'gong', label: 'Gong' },
  { value: 'beep', label: 'Beep' },
]

const ALARM_PATTERNS: Record<TimerAlarmSound, number[]> = {
  classic: [880, 988, 1046],
  digital: [1200, 900, 1200],
  bell: [660, 880],
  chime: [523, 659, 784],
  soft: [392, 440],
  focus: [740, 932, 740],
  crystal: [988, 1174, 1318],
  pulse: [550, 550, 550, 784],
  gong: [220, 262, 330],
  beep: [1000],
}

const ALARM_TOTAL_DURATION_SECONDS = 10
const ALARM_REPEAT_INTERVAL_SECONDS = 1.2

const TRACKED_TIMER_MODES: TimerMode[] = ['pomodoro', 'custom']

const shouldTrackTimerMode = (mode: TimerMode | null): mode is TimerMode => {
  return !!mode && TRACKED_TIMER_MODES.includes(mode)
}

const playAlarm = (sound: TimerAlarmSound, enabled: boolean) => {
  if (!enabled) return

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const now = context.currentTime
  const pattern = ALARM_PATTERNS[sound] || ALARM_PATTERNS.classic

  for (
    let repeatOffset = 0;
    repeatOffset < ALARM_TOTAL_DURATION_SECONDS;
    repeatOffset += ALARM_REPEAT_INTERVAL_SECONDS
  ) {
    pattern.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.connect(gainNode)
      gainNode.connect(context.destination)

      const startAt = now + repeatOffset + index * 0.18
      const endAt = startAt + 0.16

      gainNode.gain.setValueAtTime(0.0001, startAt)
      gainNode.gain.exponentialRampToValueAtTime(0.5, startAt + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt)

      oscillator.start(startAt)
      oscillator.stop(endAt)
    })
  }

  setTimeout(() => {
    context.close().catch(() => undefined)
  }, (ALARM_TOTAL_DURATION_SECONDS + 0.5) * 1000)
}

const previewAlarm = (sound: TimerAlarmSound, enabled: boolean) => {
  if (!enabled) return

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const now = context.currentTime
  const pattern = ALARM_PATTERNS[sound] || ALARM_PATTERNS.classic

  pattern.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    const startAt = now + index * 0.12
    const endAt = startAt + 0.1

    gainNode.gain.setValueAtTime(0.0001, startAt)
    gainNode.gain.exponentialRampToValueAtTime(0.5, startAt + 0.015)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt)

    oscillator.start(startAt)
    oscillator.stop(endAt)
  })

  const totalPreviewMs = Math.ceil((pattern.length * 0.12 + 0.2) * 1000)
  setTimeout(() => {
    context.close().catch(() => undefined)
  }, totalPreviewMs)
}

export const getDefaultDurationForMode = (
  mode: TimerMode,
  customDurationMs: number = DEFAULT_CUSTOM_DURATION_MS
) => {
  if (mode === 'shortBreak') return DEFAULT_SHORT_BREAK_DURATION_MS
  if (mode === 'longBreak') return DEFAULT_LONG_BREAK_DURATION_MS
  if (mode === 'custom') return customDurationMs
  return DEFAULT_POMODORO_DURATION_MS
}

export const formatTimeFromMs = (ms: number) => {
  const totalSeconds = Math.max(Math.floor(ms / MS_IN_SECOND), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}

export function useSharedTimer() {
  const queryClient = useQueryClient()
  const {
    timerMode,
    timerDurationMs,
    timerElapsedMs,
    timerStartedAt,
    timerRunning,
    customDurationMs,
    floatingTimerPosition,
    soundEnabled,
    timerAlarmSound,
    startTimer: startStoreTimer,
    stopTimer: stopStoreTimer,
    resetTimer: resetStoreTimer,
    setCustomDurationMs,
    setFloatingTimerPosition,
    setTimerAlarmSound,
    setSoundEnabled,
  } = useStore((state) => ({
    timerMode: state.timerMode,
    timerDurationMs: state.timerDurationMs,
    timerElapsedMs: state.timerElapsedMs,
    timerStartedAt: state.timerStartedAt,
    timerRunning: state.timerRunning,
    customDurationMs: state.customDurationMs,
    floatingTimerPosition: state.floatingTimerPosition,
    soundEnabled: state.soundEnabled,
    timerAlarmSound: state.timerAlarmSound,
    startTimer: state.startTimer,
    stopTimer: state.stopTimer,
    resetTimer: state.resetTimer,
    setCustomDurationMs: state.setCustomDurationMs,
    setFloatingTimerPosition: state.setFloatingTimerPosition,
    setTimerAlarmSound: state.setTimerAlarmSound,
    setSoundEnabled: state.setSoundEnabled,
  }))

  const [now, setNow] = useState(Date.now())
  const lastElapsedRef = useRef(0)
  const completionGuardRef = useRef(false)

  useEffect(() => {
    if (!timerRunning || !timerStartedAt) return

    setNow(Date.now())

    const tick = setInterval(() => setNow(Date.now()), MS_IN_SECOND)
    return () => clearInterval(tick)
  }, [timerRunning, timerStartedAt])

  const elapsedMs = useMemo(() => {
    if (!timerMode) return 0
    const runningElapsed = timerRunning && timerStartedAt ? Math.max(now - timerStartedAt, 0) : 0
    const totalElapsed = timerElapsedMs + runningElapsed
    const safeElapsed = Math.max(totalElapsed, 0)
    return timerDurationMs ? Math.min(safeElapsed, timerDurationMs) : safeElapsed
  }, [timerDurationMs, timerElapsedMs, timerMode, timerRunning, timerStartedAt, now])

  useEffect(() => {
    lastElapsedRef.current = elapsedMs
  }, [elapsedMs])

  const timeLeftMs = useMemo(() => {
    if (!timerDurationMs) return 0
    return Math.max(timerDurationMs - elapsedMs, 0)
  }, [elapsedMs, timerDurationMs])

  const invalidateTimeQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['time-tracking-core'] })
    queryClient.invalidateQueries({ queryKey: ['time-weekly-distribution'] })
    queryClient.invalidateQueries({ queryKey: ['time-analytics'] })
  }, [queryClient])

  const persistElapsedSession = useCallback(async (elapsed: number, sessionMode: TimerMode | null, reason: string) => {
    if (!shouldTrackTimerMode(sessionMode)) return

    const elapsedSeconds = Math.max(1, Math.floor(elapsed / MS_IN_SECOND))
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - elapsedSeconds * MS_IN_SECOND)

    await database.createTimeBlock({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration: elapsedSeconds,
      notes: `${sessionMode || 'focus'} session (${reason})`,
    })

    invalidateTimeQueries()
  }, [invalidateTimeQueries])

  const stopTimer = useCallback(async (reason: 'manual-stop' | 'reset' | 'complete' = 'manual-stop') => {
    const elapsedAtStop = lastElapsedRef.current
    const modeAtStop = timerMode

    if (elapsedAtStop > 0) {
      try {
        await persistElapsedSession(elapsedAtStop, modeAtStop, reason)
      } catch (error) {
        console.error('Failed to persist timer session:', error)
      }
    }

    stopStoreTimer()
  }, [persistElapsedSession, stopStoreTimer, timerMode])

  const resetTimer = useCallback(async (durationMs?: number) => {
    const elapsedAtReset = lastElapsedRef.current
    const modeAtReset = timerMode

    if (elapsedAtReset > 0) {
      try {
        await persistElapsedSession(elapsedAtReset, modeAtReset, 'reset')
      } catch (error) {
        console.error('Failed to persist timer reset session:', error)
      }
    }

    resetStoreTimer(durationMs)
    completionGuardRef.current = false
  }, [persistElapsedSession, resetStoreTimer, timerMode])

  const startTimer = useCallback(async (mode: TimerMode, durationMs: number) => {
    if (timerRunning && lastElapsedRef.current > 0) {
      try {
        await persistElapsedSession(lastElapsedRef.current, timerMode, 'switch')
      } catch (error) {
        console.error('Failed to persist previous timer session:', error)
      }
    }

    completionGuardRef.current = false
    startStoreTimer(mode, durationMs)
  }, [persistElapsedSession, startStoreTimer, timerMode, timerRunning])

  useEffect(() => {
    if (!timerRunning) {
      completionGuardRef.current = false
      return
    }
    if (!timerDurationMs) return
    if (elapsedMs < timerDurationMs) return
    if (completionGuardRef.current) return

    completionGuardRef.current = true

    ;(async () => {
      await stopTimer('complete')
      playAlarm(timerAlarmSound, soundEnabled)
      resetStoreTimer(timerDurationMs)
      completionGuardRef.current = false
    })()
  }, [elapsedMs, resetStoreTimer, soundEnabled, stopTimer, timerAlarmSound, timerDurationMs, timerRunning])

  const progress = useMemo(() => {
    if (!timerDurationMs) return 0
    return Math.min((elapsedMs / timerDurationMs) * 100, 100)
  }, [elapsedMs, timerDurationMs])

  return {
    timerMode,
    timerRunning,
    timerDurationMs,
    elapsedMs,
    timeLeftMs,
    progress,
    formattedTimeLeft: formatTimeFromMs(timeLeftMs),
    formattedElapsed: formatTimeFromMs(elapsedMs),
    customDurationMs,
    soundEnabled,
    timerAlarmSound,
    setSoundEnabled,
    setTimerAlarmSound,
    alarmOptions: TIMER_ALARM_OPTIONS,
    previewAlarm,
    floatingTimerPosition,
    startTimer,
    stopTimer,
    resetTimer,
    setCustomDurationMs,
    setFloatingTimerPosition,
  }
}

export const timerPositions: FloatingTimerPosition[] = [
  'bottom-right',
  'bottom-left',
  'top-left',
  'top-right',
]
