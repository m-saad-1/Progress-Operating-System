/**
 * DAILY RESET HOOK
 * ================
 * Handles automatic daily reset of continuous tasks and habits at midnight.
 */

import { useEffect, useRef, useCallback } from 'react'
import { format, startOfDay, startOfMonth, differenceInCalendarDays } from 'date-fns'
import { safeParseDate } from '@/lib/date-safe'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '@/store'
import { database } from '@/lib/database'
import { shouldResetTask, resetTaskForNewDay, normalizeDailyProgress } from '@/lib/daily-reset'
import {
  calculateConsistency,
  validateHabitIntegrity,
} from '@/lib/habit-daily-reset'
import { calculateHabitStreaks } from '@/lib/habit-streaks'
import type { Habit, TaskProgress } from '@/types'

const isValidDateKey = (value: string | null | undefined): value is string => {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

const toLocalDateKey = (value: string): string | null => {
  try {
    return format(startOfDay(safeParseDate(value)), 'yyyy-MM-dd')
  } catch {
    return null
  }
}

const getNearestHistoryEntryOnOrBefore = (
  history: Record<string, { progress: TaskProgress; status: any; recorded_at: string; source: any }>,
  targetKey: string
) => {
  const candidateKeys = Object.keys(history)
    .filter((key) => isValidDateKey(key) && key <= targetKey)
    .sort((a, b) => a.localeCompare(b))

  if (candidateKeys.length === 0) {
    return null
  }

  return history[candidateKeys[candidateKeys.length - 1]] ?? null
}

const getLatestDateKey = (keys: string[]): string | null => {
  const valid = keys.filter(isValidDateKey)
  if (valid.length === 0) return null
  const sorted = valid.sort((a, b) => a.localeCompare(b))
  return sorted[sorted.length - 1] ?? null
}

const deriveLastProcessedDate = (
  tasks: ReturnType<typeof useStore.getState>['tasks'],
  todayKey: string
): string => {
  const candidates: string[] = []

  tasks.forEach((task) => {
    if (isValidDateKey(task.last_reset_date ?? undefined)) {
      candidates.push(task.last_reset_date as string)
    }

    const createdKey = toLocalDateKey(task.created_at)
    if (createdKey) {
      candidates.push(createdKey)
    }

    const history = normalizeDailyProgress(task)
    Object.keys(history).forEach((dateKey) => {
      if (isValidDateKey(dateKey)) {
        candidates.push(dateKey)
      }
    })
  })

  const latest = getLatestDateKey(candidates)
  if (!latest) return todayKey

  return latest > todayKey ? todayKey : latest
}

export const useDailyReset = () => {
  const queryClient = useQueryClient()
  const updateTask = useStore((state) => state.updateTask)
  const updateHabit = useStore((state) => state.updateHabit)
  const lastResetDateRef = useRef<string | null>(null)
  const resetInFlightRef = useRef(false)
  const initializedRef = useRef(false)

  const performDailyReset = useCallback(async () => {
    if (resetInFlightRef.current) {
      return
    }

    resetInFlightRef.current = true

    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const currentTasks = useStore.getState().tasks
      const currentHabits = useStore.getState().habits

      // Self-heal pass: backfill missing snapshot on last_reset_date for continuous tasks.
      try {
        for (const task of currentTasks) {
          if (task.deleted_at || task.duration_type !== 'continuous' || task.is_paused) continue

          const resetKey = task.last_reset_date
          if (!isValidDateKey(resetKey)) continue
          if (resetKey >= today) continue

          const history = normalizeDailyProgress(task)
          if (history[resetKey]) continue

          const fallback = getNearestHistoryEntryOnOrBefore(history as any, resetKey)
          const snapshot = fallback
            ? {
                progress: fallback.progress,
                status: fallback.status,
                recorded_at: new Date().toISOString(),
                source: 'rollover' as const,
              }
            : {
                progress: (task.progress || 0) as TaskProgress,
                status: task.is_paused ? 'skipped' : (task.status || 'pending'),
                recorded_at: new Date().toISOString(),
                source: task.is_paused ? ('paused' as const) : ('rollover' as const),
              }

          history[resetKey] = snapshot

          await database.updateTask(task.id, { daily_progress: history })
          updateTask({ ...task, daily_progress: history, updated_at: new Date().toISOString() })
        }
      } catch (error) {
        console.error('Error during continuous snapshot self-heal:', error)
      }

      if (!initializedRef.current) {
        if (currentTasks.length === 0 && currentHabits.length === 0) {
          return
        }

        lastResetDateRef.current = deriveLastProcessedDate(currentTasks, today)
        initializedRef.current = true
      }

      const lastResetDate = lastResetDateRef.current ?? today
      if (today === lastResetDate) return

      const lastResetDay = startOfDay(safeParseDate(lastResetDate))
      const todayDay = startOfDay(safeParseDate(today))
      const daysMissed = differenceInCalendarDays(todayDay, lastResetDay)

      // Part 1: snapshot and reset tasks.
      try {
        for (const task of currentTasks) {
          if (task.deleted_at) continue

          try {
            const now = new Date()
            let history = normalizeDailyProgress(task)
            let needsUpdate = false

            if (daysMissed >= 1) {
              for (let i = 0; i < daysMissed; i++) {
                const snapshotDay = new Date(lastResetDay)
                snapshotDay.setDate(snapshotDay.getDate() + i)
                const snapshotKey = format(snapshotDay, 'yyyy-MM-dd')

                const shouldReplaceSnapshot = snapshotKey === lastResetDate
                if (shouldReplaceSnapshot || !history[snapshotKey]) {
                  if (task.duration_type === 'today') {
                    const createdKey = format(startOfDay(safeParseDate(task.created_at)), 'yyyy-MM-dd')
                    if (snapshotKey !== createdKey) continue
                  }

                  if (task.is_paused) {
                    continue
                  }

                  history[snapshotKey] = {
                    progress: (task.progress || 0) as TaskProgress,
                    status: task.status || 'pending',
                    recorded_at: now.toISOString(),
                    source: 'rollover',
                  }
                  needsUpdate = true
                }
              }
            }

            if (task.is_paused) {
              if (needsUpdate) {
                const updatedTask = {
                  ...task,
                  daily_progress: history,
                  updated_at: now.toISOString(),
                }

                await database.updateTask(task.id, { daily_progress: history })
                updateTask(updatedTask)
              }
              continue
            }

            if (shouldResetTask(task) && task.last_reset_date !== today) {
              const resetData = resetTaskForNewDay()
              const updatedTask = {
                ...task,
                ...resetData,
                daily_progress: history,
                last_reset_date: today,
                updated_at: now.toISOString(),
              }

              await database.updateTask(task.id, updatedTask)
              updateTask(updatedTask)
            } else if (needsUpdate) {
              const updatedTask = {
                ...task,
                daily_progress: history,
                updated_at: now.toISOString(),
              }

              await database.updateTask(task.id, { daily_progress: history })
              updateTask(updatedTask)
            }
          } catch (error) {
            console.error(`Failed to reset task ${task.id}:`, error)
          }
        }
      } catch (error) {
        console.error('Error during task daily reset:', error)
      }

      // Part 2: recalculate habit metrics.
      try {
        const habitsToUpdate: Habit[] = []

        for (const habit of currentHabits) {
          if (habit.deleted_at) continue

          const allCompletions = await database.getHabitCompletions(
            format(new Date(habit.created_at), 'yyyy-MM-dd'),
            today
          )
          const habitCompletions = allCompletions.filter((c) => c.habit_id === habit.id)

          const { current: currentStreak, longest: longestStreak } = calculateHabitStreaks(
            habit,
            habitCompletions
          )
          const consistency = calculateConsistency(
            habitCompletions,
            habit.created_at,
            habit.frequency,
            habit.schedule,
            { start: startOfMonth(new Date()), end: new Date() }
          )

          if (
            habit.streak_current !== currentStreak ||
            habit.streak_longest !== longestStreak ||
            habit.consistency_score !== consistency
          ) {
            const updatedHabit = {
              ...habit,
              streak_current: currentStreak,
              streak_longest: longestStreak,
              consistency_score: consistency,
              updated_at: new Date().toISOString(),
            }

            if (validateHabitIntegrity(updatedHabit, habitCompletions)) {
              habitsToUpdate.push(updatedHabit)
            }
          }
        }

        for (const habit of habitsToUpdate) {
          try {
            await database.updateHabit(habit.id, {
              streak_current: habit.streak_current,
              streak_longest: habit.streak_longest,
              consistency_score: habit.consistency_score,
            })
            updateHabit(habit)
          } catch (error) {
            console.error(`Failed to update habit ${habit.id}:`, error)
          }
        }
      } catch (error) {
        console.error('Error during habit daily reset:', error)
      }

      // Mark day as processed only after rollover work completes.
      lastResetDateRef.current = today
      queryClient.invalidateQueries()
    } finally {
      resetInFlightRef.current = false
    }
  }, [queryClient, updateHabit, updateTask])

  useEffect(() => {
    performDailyReset()

    let midnightTimeout: ReturnType<typeof setTimeout> | null = null

    const scheduleNextMidnightReset = () => {
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setHours(24, 0, 0, 0)
      const delay = Math.max(250, nextMidnight.getTime() - now.getTime() + 50)

      midnightTimeout = setTimeout(() => {
        performDailyReset()
        scheduleNextMidnightReset()
      }, delay)
    }

    scheduleNextMidnightReset()

    const interval = setInterval(() => {
      performDailyReset()
    }, 60 * 1000)

    return () => {
      clearInterval(interval)
      if (midnightTimeout) {
        clearTimeout(midnightTimeout)
      }
    }
  }, [performDailyReset])
}

export default useDailyReset
