import { StateCreator } from 'zustand'
import { Store } from '../index'
import { TimerMode, FloatingTimerPosition, TimerAlarmSound } from '../types'

export const DEFAULT_POMODORO_DURATION_MS = 25 * 60 * 1000
export const DEFAULT_SHORT_BREAK_DURATION_MS = 5 * 60 * 1000
export const DEFAULT_LONG_BREAK_DURATION_MS = 15 * 60 * 1000
export const DEFAULT_CUSTOM_DURATION_MS = DEFAULT_POMODORO_DURATION_MS

export interface TimerSlice {
  timerMode: TimerMode | null
  timerDurationMs: number
  timerElapsedMs: number
  timerStartedAt: number | null
  timerRunning: boolean
  customDurationMs: number
  floatingTimerPosition: FloatingTimerPosition
  timerAlarmSound: TimerAlarmSound

  startTimer: (mode: TimerMode, durationMs: number) => void
  stopTimer: () => void
  resetTimer: (durationMs?: number) => void
  setCustomDurationMs: (durationMs: number) => void
  setFloatingTimerPosition: (position: FloatingTimerPosition) => void
  setTimerAlarmSound: (sound: TimerAlarmSound) => void
}

export const createTimerSlice: StateCreator<
  Store,
  [['zustand/persist', unknown]],
  [],
  TimerSlice
> = (set) => ({
  timerMode: null,
  timerDurationMs: DEFAULT_POMODORO_DURATION_MS,
  timerElapsedMs: 0,
  timerStartedAt: null,
  timerRunning: false,
  customDurationMs: DEFAULT_CUSTOM_DURATION_MS,
  floatingTimerPosition: 'bottom-right',
  timerAlarmSound: 'classic',

  startTimer: (mode, durationMs) =>
    set((state) => ({
      timerMode: mode,
      timerDurationMs: durationMs,
      // Preserve elapsed time when resuming a paused timer
      // Only reset to 0 when starting fresh
      timerElapsedMs: state.timerMode === mode ? state.timerElapsedMs : 0,
      timerStartedAt: Date.now(),
      timerRunning: true,
    })),
  stopTimer: () =>
    set((state) => {
      if (!state.timerRunning) {
        return { timerRunning: false, timerStartedAt: null }
      }

      const elapsedSinceStart = state.timerStartedAt
        ? Date.now() - state.timerStartedAt
        : 0

      const updatedElapsed = Math.min(
        state.timerElapsedMs + elapsedSinceStart,
        state.timerDurationMs
      )

      return {
        timerRunning: false,
        timerStartedAt: null,
        timerElapsedMs: updatedElapsed,
      }
    }),
  resetTimer: (durationMs) =>
    set((state) => ({
      timerDurationMs: durationMs ?? state.timerDurationMs,
      timerElapsedMs: 0,
      timerStartedAt: null,
      timerRunning: false,
    })),
  setCustomDurationMs: (durationMs) =>
    set((state) => ({
      customDurationMs: durationMs,
      // Only update the scheduled duration when the custom timer is inactive
      ...(state.timerMode === 'custom' && !state.timerRunning
        ? { timerDurationMs: durationMs, timerElapsedMs: 0 }
        : {}),
    })),
  setFloatingTimerPosition: (position) => set({ floatingTimerPosition: position }),
  setTimerAlarmSound: (timerAlarmSound) => set({ timerAlarmSound }),
})
