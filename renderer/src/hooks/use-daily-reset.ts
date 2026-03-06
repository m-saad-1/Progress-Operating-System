/**
 * DAILY RESET HOOK
 * ================
 * Handles automatic daily reset of continuous tasks AND habits at midnight (12:00 AM local time)
 * 
 * KEY FEATURES:
 * - Detects midnight transitions (12:00 AM local time)
 * - Handles multi-day offline gaps (date-based, not session-based)
 * - Snapshots all tasks (today-only AND continuous) into daily_progress before advancing
 * - Resets continuous tasks (status='pending', progress=0) for the new day
 * - Recalculates habit streaks and consistency from completion history
 * - Preserves task history in daily_progress
 * - Preserves habit history in habit_completions
 * - Updates UI reactively for both tasks and habits
 * - Invalidates React Query cache at midnight for real-time data freshness
 */

import { useEffect, useRef, useCallback } from 'react'
import { format, startOfDay, differenceInCalendarDays } from 'date-fns'
import { safeParseDate } from '@/lib/date-safe'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '@/store'
import { database } from '@/lib/database'
import { shouldResetTask, resetTaskForNewDay, normalizeDailyProgress } from '@/lib/daily-reset'
import {
  calculateConsistency,
  validateHabitIntegrity
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
  habits: Habit[],
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

  habits.forEach((habit) => {
    const createdKey = toLocalDateKey(habit.created_at)
    if (createdKey) {
      candidates.push(createdKey)
    }

    const updatedKey = toLocalDateKey(habit.updated_at)
    if (updatedKey) {
      candidates.push(updatedKey)
    }
  })

  const latest = getLatestDateKey(candidates)
  if (!latest) return todayKey

  return latest > todayKey ? todayKey : latest
}

/**
 * Hook that detects daily reset and updates continuous tasks + habits
 * Call this at the app root level to ensure it runs globally
 * 
 * ⚠️ DATA INTEGRITY RULES:
 * - Only modifies current status/progress of continuous tasks (resets them to pending/0)
 * - Snapshots EVERY task's final state into daily_progress before resetting
 * - NEVER deletes or removes any task data
 * - NEVER removes tasks from "Yesterday" section via deletion
 * - Yesterday section updates visually at midnight through getTodaysTasks/getYesterdaysTasks
 * - Task history is preserved in daily_progress and habit_completions tables
 * - Old tasks remain in database indefinitely unless explicitly user-deleted
 * - Handles multi-day offline gaps: snapshots each missed day properly
 * - Invalidates React Query cache for real-time UI updates
 */
export const useDailyReset = () => {
  const queryClient = useQueryClient()
  const { tasks, updateTask, habits, updateHabit } = useStore()
  const lastResetDateRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  const performDailyReset = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd')

    // Self-heal pass: if a continuous task has a recorded last_reset_date prior to today,
    // but the matching daily_progress snapshot is missing, backfill it deterministically.
    // This protects Yesterday section classification from legacy missed-rollover states.
    // ⚠️ SKIP PAUSED TASKS: Paused tasks are frozen and should not be processed
    try {
      for (const task of tasks) {
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
      if (tasks.length === 0 && habits.length === 0) {
        return
      }

      lastResetDateRef.current = deriveLastProcessedDate(tasks, habits, today)
      initializedRef.current = true
    }

    const lastResetDate = lastResetDateRef.current ?? today

    // Only reset if we've crossed into a new day
    if (today === lastResetDate) return

    console.log(`Daily reset triggered: ${lastResetDate} → ${today}`)

    // Calculate how many days have elapsed (handles multi-day offline gaps)
    const lastResetDay = startOfDay(safeParseDate(lastResetDate))
    const todayDay = startOfDay(safeParseDate(today))
    const daysMissed = differenceInCalendarDays(todayDay, lastResetDay)

    // PART 1: Snapshot and reset tasks
    // For every task, ensure daily_progress has an entry for the last active day
    // For continuous tasks, also reset their current status/progress
    // ⚠️ CRITICAL: Skip paused tasks entirely - they are frozen and do not participate in daily processing
    try {
      for (const task of tasks) {
        if (task.deleted_at || task.is_paused) continue

        try {
          const now = new Date()
          let history = normalizeDailyProgress(task)
          let needsUpdate = false

          // The "last active day" is yesterday relative to today (i.e., lastResetDate
          // or later). For multi-day gaps we snapshot the task's final state into each
          // missed day so that if someone looks at analytics for those days, the data
          // exists. The key insight: the task's live progress/status at the moment of
          // this reset belongs to the *last active day* (lastResetDate). For any
          // intermediate days in a multi-day gap, the same state carries forward
          // because the user wasn't active.

          if (daysMissed >= 1) {
            // Snapshot the task's current state into each missed day's daily_progress
            // if no entry already exists for that day.
            for (let i = 0; i < daysMissed; i++) {
              const snapshotDay = new Date(lastResetDay)
              snapshotDay.setDate(snapshotDay.getDate() + i)
              const snapshotKey = format(snapshotDay, 'yyyy-MM-dd')

              if (!history[snapshotKey]) {
                // For today-only tasks: only snapshot on their creation day
                if (task.duration_type === 'today') {
                  const createdKey = format(startOfDay(safeParseDate(task.created_at)), 'yyyy-MM-dd')
                  if (snapshotKey !== createdKey) continue
                }

                history[snapshotKey] = {
                  progress: (task.progress || 0) as TaskProgress,
                  status: task.is_paused ? 'skipped' : (task.status || 'pending'),
                  recorded_at: now.toISOString(),
                  source: task.is_paused ? 'paused' : 'rollover',
                }
                needsUpdate = true
              }
            }
          }

          // For continuous tasks: reset for the new day
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
            console.log(`Reset continuous task: ${task.title}`)
          } else if (needsUpdate) {
            // Non-continuous tasks just need their daily_progress updated
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

    // PART 2: Recalculate habit metrics from completion history
    try {
      const habitsToUpdate: Habit[] = []

      for (const habit of habits) {
        if (habit.deleted_at) continue

        // Fetch full completion history for this habit
        const endDate = today

        const allCompletions = await database.getHabitCompletions(
          format(new Date(habit.created_at), 'yyyy-MM-dd'),
          endDate
        )
        const habitCompletions = allCompletions.filter(c => c.habit_id === habit.id)

        // Calculate metrics from history
        const { current: currentStreak, longest: longestStreak } = calculateHabitStreaks(
          habit,
          habitCompletions
        )
        const consistency = calculateConsistency(
          habitCompletions,
          habit.created_at,
          habit.frequency,
          habit.schedule
        )

        // Only update if values changed
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

          // Validate integrity before updating
          if (validateHabitIntegrity(updatedHabit, habitCompletions)) {
            habitsToUpdate.push(updatedHabit)
          } else {
            console.warn(`Integrity check failed for habit ${habit.id}`)
          }
        }
      }

      if (habitsToUpdate.length > 0) {
        console.log(`Updating metrics for ${habitsToUpdate.length} habits`)

        for (const habit of habitsToUpdate) {
          try {
            await database.updateHabit(habit.id, {
              streak_current: habit.streak_current,
              streak_longest: habit.streak_longest,
              consistency_score: habit.consistency_score,
            })
            updateHabit(habit)
            console.log(
              `Updated habit ${habit.title}: streak=${habit.streak_current}, consistency=${habit.consistency_score}%`
            )
          } catch (error) {
            console.error(`Failed to update habit ${habit.id}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Error during habit daily reset:', error)
    }

    // Mark day as processed only after rollover work completes.
    lastResetDateRef.current = today

    // Invalidate all React Query caches to ensure real-time UI updates at midnight
    // This refreshes analytics, dashboard stats, task lists, habit data, etc.
    console.log('[Daily Reset] Invalidating all queries for fresh data')
    queryClient.invalidateQueries()
    
    console.log('[Daily Reset] Daily reset completed successfully')
  }, [tasks, updateTask, habits, updateHabit, queryClient])

  // Check for midnight transition every minute
  useEffect(() => {
    // Run immediately on mount
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

    // Fallback polling every minute for resilience after sleep/wake or timer drift
    const interval = setInterval(() => {
      performDailyReset()
    }, 60 * 1000) // 60 seconds

    return () => {
      clearInterval(interval)
      if (midnightTimeout) {
        clearTimeout(midnightTimeout)
      }
    }
  }, [performDailyReset])
}

export default useDailyReset

