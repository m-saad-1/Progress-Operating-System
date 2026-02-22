/**
 * DAILY RESET UTILITIES
 * =====================
 * Handles daily task rollover behavior at midnight (12:00 AM local time)
 * Also handles weekly and monthly habit reset behaviors
 * 
 * KEY CONCEPTS:
 * - Tasks are organized by "task occurrence date" (when they were created for that day)
 * - "Today" = current calendar day
 * - "Yesterday" = previous calendar day
 * - "Continuous" tasks reset daily (same task ID appears every day as fresh)
 * - "Today-only" tasks don't appear after their day ends
 * - Task history is preserved in daily_progress for analytics
 * 
 * ⚠️ CRITICAL DATA INTEGRITY RULES:
 * ================================
 * 1. UI FILTERING IS NOT DATA DELETION
 *    - getTodaysTasks, getYesterdaysTasks, getArchivedTasks are UI filters ONLY
 *    - These functions DO NOT delete or modify tasks in the database
 *    - Tasks continue to exist after disappearing from view
 * 
 * 2. STATS CALCULATION IS HISTORY-BASED, NOT UI-BASED
 *    - Statistics functions (calculateTaskAnalytics, calculateDailyProgress)
 *    - Use ALL tasks from the database, not UI-filtered lists
 *    - Stats include tasks that have aged out of the Today/Yesterday sections
 *    - Historical data is preserved for analytics and progress tracking
 * 
 * 3. STATE PRESERVATION ON ROLLOVER (12:00 AM)
 *    - Task completion status carries from Yesterday → Today
 *    - Completion records are stored in daily_progress
 *    - Habit streaks are calculated from habit_completions history
 *    - No data is lost during daily reset
 * 
 * 4. TASK CLEANUP WITHOUT DATA LOSS
 *    - Yesterday section cleanup: Visual only (filter removes from display)
 *    - Page reload: Yesterday section recalculated correctly based on real dates
 *    - Task data: Remains in database indefinitely unless explicitly deleted
 *    - Metadata: Priority, time, labels, descriptions preserved
 * 
 * HABIT RESETS:
 * - Daily habits: don't reset individually (managed per day at UI level)
 * - Weekly habits: reset on Monday (after Sunday completes)
 * - Monthly habits: reset on 1st of month (after month completes)
 */

import { startOfDay, isToday, isYesterday, isBefore, format, parseISO } from 'date-fns'
import type { Task, TaskStatus, TaskProgress, DailyTaskState } from '@/types'

const getDayKey = (date: Date): string => format(date, 'yyyy-MM-dd')

const deriveStatusFromProgress = (progress: number, fallback?: TaskStatus): TaskStatus => {
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'in-progress'
  return fallback ?? 'skipped'
}

export const normalizeDailyProgress = (task: Task): Record<string, DailyTaskState> => {
  const normalized: Record<string, DailyTaskState> = {}
  const raw = task.daily_progress || {}

  Object.entries(raw).forEach(([date, value]) => {
    if (value && typeof value === 'object' && 'progress' in (value as any)) {
      const entry = value as any
      const progress = typeof entry.progress === 'number' ? entry.progress : 0
      normalized[date] = {
        progress: progress as TaskProgress,
        status: (entry.status as TaskStatus) || deriveStatusFromProgress(progress, task.status),
        recorded_at: entry.recorded_at || task.updated_at || task.created_at,
        source: entry.source || 'user',
      }
    } else {
      const progress = typeof value === 'number' ? value : 0
      normalized[date] = {
        progress: progress as TaskProgress,
        status: deriveStatusFromProgress(progress, task.status),
        recorded_at: task.updated_at || task.created_at,
        source: 'user',
      }
    }
  })

  return normalized
}

export const getDailyEntry = (task: Task, date: Date = new Date()): DailyTaskState => {
  const key = getDayKey(date)
  const history = normalizeDailyProgress(task)
  if (history[key]) return history[key]

  const progress = (task.progress ?? 0) as TaskProgress
  return {
    progress,
    status: task.status ?? deriveStatusFromProgress(progress),
    recorded_at: task.updated_at || task.created_at,
    source: 'user',
  }
}

export const isTaskPausedOnDate = (task: Task, date: Date = new Date()): boolean => {
  const history = normalizeDailyProgress(task)
  const dayKey = getDayKey(startOfDay(date))
  const dayEntry = history[dayKey]

  if (dayEntry) {
    return dayEntry.source === 'paused'
  }

  const todayKey = getDayKey(startOfDay(new Date()))
  return dayKey === todayKey && task.is_paused === true
}

export const upsertDailyEntry = (
  task: Task,
  date: Date,
  entry: Partial<DailyTaskState> & { progress: TaskProgress }
): Record<string, DailyTaskState> => {
  const key = getDayKey(date)
  const history = normalizeDailyProgress(task)
  const previous = history[key]

  history[key] = {
    progress: entry.progress,
    status: entry.status || previous?.status || deriveStatusFromProgress(entry.progress, task.status),
    recorded_at: entry.recorded_at || previous?.recorded_at || new Date().toISOString(),
    source: entry.source || previous?.source || 'user',
  }

  return history
}

/**
 * Determines the occurrence date of a task (when it was created for a specific day)
 * For continuous tasks, this should be re-calculated based on the current day
 * For today-only tasks, this is their created_at date
 */
export const getTaskOccurrenceDate = (task: Task, referenceDate: Date = new Date()): Date => {
  const taskCreatedAt = parseISO(task.created_at)
  const createdDay = startOfDay(taskCreatedAt)
  const refDay = startOfDay(referenceDate)
  
  // If task is continuous and was created before reference date, it occurred today
  if (task.duration_type === 'continuous' && isBefore(createdDay, refDay)) {
    return refDay
  }
  
  // Otherwise, task occurred on its creation date
  return createdDay
}

/**
 * Filters tasks that belong to "Today" (current calendar day)
 * 
 * ⚠️ IMPORTANT: This function FILTERS tasks for UI display only
 * It does NOT delete, archive, or modify any data in the database
 * 
 * Returns:
 * - Includes today-only tasks created today
 * - Includes continuous tasks (they reset daily)
 * - Excludes tasks with due_date in the past
 * - Excludes tasks deleted before today
 * 
 * Tasks disappearing from this section after midnight are still in the database
 * and still counted in statistics. UI filtering ≠ data deletion.
 */
export const getTodaysTasks = (tasks: Task[]): Task[] => {
  const today = startOfDay(new Date())
  const todayKey = getDayKey(today)

  return tasks.filter(task => {
    if (task.deleted_at) return false

    const createdDay = startOfDay(parseISO(task.created_at))

    if (task.duration_type === 'continuous') {
      // Continuous tasks are always active on/after their creation date
      if (createdDay.getTime() > today.getTime()) return false

      return true
    }

    // Today-only tasks only show on their creation day
    if (getDayKey(createdDay) !== todayKey) return false
    
    return true
  })
}

/**
 * Filters tasks that belong to "Yesterday" (previous calendar day)
 * 
 * ⚠️ IMPORTANT: This function FILTERS tasks for UI display only
 * It does NOT delete, archive, or modify any data in the database
 * 
 * YESTERDAY is a pure one-day historical snapshot:
 * - Shows today-only tasks that were created on yesterday's calendar date
 * - Shows continuous tasks that have a daily_progress entry for yesterday
 *   (so the user can see and edit their final state from the prior day)
 * - Excludes tasks with due_date before yesterday
 * - NEVER shows archived, restored, or duplicated entries
 * - NEVER merges multiple days
 * 
 * At 12:00 AM (midnight), the previous YESTERDAY disappears and the new
 * yesterday is shown. Data remains in database for stats — this is UI only.
 */
export const getYesterdaysTasks = (tasks: Task[]): Task[] => {
  const now = new Date()
  const todayKey = getDayKey(startOfDay(now))
  const yesterday = startOfDay(new Date(now))
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = getDayKey(yesterday)

  return tasks.filter(task => {
    if (task.deleted_at) return false

    const createdDay = startOfDay(parseISO(task.created_at))

    if (task.duration_type === 'today') {
      // Today-only tasks: show in yesterday if created on yesterday's date
      if (getDayKey(createdDay) !== yesterdayKey) return false

      return true
    }

    if (task.duration_type === 'continuous') {
      // Continuous tasks: show in yesterday ONLY if they have a daily_progress
      // snapshot for yesterday (written by the rollover process).
      // This avoids duplicating tasks that already appear in TODAY.
      const history = normalizeDailyProgress(task)
      const yesterdayEntry = history[yesterdayKey]
      if (!yesterdayEntry) return false

      // Paused state is a Today-context freeze only and should not move into
      // Yesterday section during rollover.
      if (yesterdayEntry.source === 'paused') return false

      // Restore rules:
      // - Restored same day as deletion => yesterday entry is marked as 'restore' and should be shown
      // - Restored after one or more days => today gets 'restore' marker, yesterday should stay hidden
      const restoredToday = history[todayKey]?.source === 'restore'
      if (restoredToday && yesterdayEntry.source !== 'restore') return false

      return true
    }

    return false
  })
}

/**
 * Gets all tasks older than yesterday
 * Used for archiving/historical view
 */
export const getArchivedTasks = (tasks: Task[]): Task[] => {
  const yesterday = startOfDay(new Date())
  yesterday.setDate(yesterday.getDate() - 1)
  
  return tasks.filter(task => {
    if (task.deleted_at) return false
    
    const taskCreatedAt = startOfDay(parseISO(task.created_at))
    
    if (task.duration_type === 'continuous') {
      // Continuous tasks are never really "archived", they keep appearing
      return false
    } else {
      // Today-only tasks older than yesterday are archived
      return isBefore(taskCreatedAt, yesterday)
    }
  })
}

/**
 * Filters tasks that should be visible in a date range
 * Used for analytics calculations
 * 
 * CRITICAL: Only count tasks that actually existed/occurred in the date range
 */
export const getTasksInDateRange = (
  tasks: Task[],
  startDate: Date,
  endDate: Date
): Task[] => {
  const rangeStart = startOfDay(startDate)
  const rangeEnd = startOfDay(endDate)
  
  return tasks.filter(task => {
    const history = normalizeDailyProgress(task)

    const hasHistoryInRange = Object.keys(history).some((dateKey) => {
      const day = startOfDay(parseISO(dateKey))
      return !isBefore(day, rangeStart) && !isBefore(rangeEnd, day)
    })

    if (hasHistoryInRange) return true

    // Fallback for tasks without history: use creation date as occurrence
    const taskCreatedAt = startOfDay(parseISO(task.created_at))
    return !isBefore(taskCreatedAt, rangeStart) && !isBefore(rangeEnd, taskCreatedAt)
  })
}

/**
 * Gets the display label for when a task was created/occurred
 * Used in UI to show task recency
 */
export const getTaskOccurrenceLabel = (task: Task): string => {
  const taskDate = parseISO(task.created_at)
  
  if (isToday(taskDate)) {
    return 'Today'
  } else if (isYesterday(taskDate)) {
    return 'Yesterday'
  } else {
    return format(taskDate, 'MMM d')
  }
}

/**
 * Gets the daily progress record for a specific date
 * daily_progress is stored as Record<YYYY-MM-DD, number>
 */
export const getDailyProgress = (
  task: Task,
  date: Date = new Date()
): number => getDailyEntry(task, date).progress

export const getDailyStatus = (
  task: Task,
  date: Date = new Date()
): TaskStatus => getDailyEntry(task, date).status

/**
 * Records daily progress for a task on a specific date
 * Returns updated daily_progress record
 */
export const recordDailyProgress = (
  task: Task,
  date: Date,
  progress: TaskProgress,
  status?: TaskStatus,
  source: DailyTaskState['source'] = 'user'
): Record<string, DailyTaskState> => {
  return upsertDailyEntry(task, date, {
    progress,
    status,
    recorded_at: new Date().toISOString(),
    source,
  })
}

/**
 * Determines if a task should reset for a new day
 * Called during daily reset process at midnight
 */
export const shouldResetTask = (task: Task): boolean => {
  return task.duration_type === 'continuous'
}

/**
 * Resets a task for the new day (without modifying creation date)
 * - Clears today's progress status back to pending
 * - Preserves all history in daily_progress
 * - Keeps creation_at and other metadata
 */
export const resetTaskForNewDay = (): Partial<Task> => {
  return {
    status: 'pending',
    progress: 0,
    // daily_progress is preserved, updated_at is set by database
  }
}

// ============================================
// HABIT RESET LOGIC
// ============================================

/**
 * Determines if a weekly habit should have its completion cleared today.
 * Weekly habits reset on Monday (after completing their week).
 * 
 * @param date - The date to check (default: today)
 * @returns true if today is Monday (start of new week after Sunday)
 */
export const shouldResetWeeklyHabitToday = (date: Date = new Date()): boolean => {
  // Monday is day 1 in JavaScript (0 = Sunday, 1 = Monday, etc.)
  return date.getDay() === 1
}

/**
 * Determines if a monthly habit should have its completion cleared today.
 * Monthly habits reset on the 1st of each month (after completing their month).
 * 
 * @param date - The date to check (default: today)
 * @returns true if today is the 1st of the month
 */
export const shouldResetMonthlyHabitToday = (date: Date = new Date()): boolean => {
  return date.getDate() === 1
}

/**
 * Gets the most recent reset point for a weekly habit.
 * Returns the Monday of the current or last week.
 * 
 * @param date - The reference date (default: today)
 * @returns Date representing the most recent Monday
 */
export const getLastWeeklyResetDate = (date: Date = new Date()): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}

/**
 * Gets the most recent reset point for a monthly habit.
 * Returns the 1st of the current or last month.
 * 
 * @param date - The reference date (default: today)
 * @returns Date representing the 1st of the month
 */
export const getLastMonthlyResetDate = (date: Date = new Date()): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default {
  getTaskOccurrenceDate,
  getTodaysTasks,
  getYesterdaysTasks,
  getArchivedTasks,
  getTasksInDateRange,
  getTaskOccurrenceLabel,
  getDailyProgress,
  getDailyStatus,
  getDailyEntry,
  isTaskPausedOnDate,
  normalizeDailyProgress,
  upsertDailyEntry,
  recordDailyProgress,
  shouldResetTask,
  resetTaskForNewDay,
  shouldResetWeeklyHabitToday,
  shouldResetMonthlyHabitToday,
  getLastWeeklyResetDate,
  getLastMonthlyResetDate,
}
