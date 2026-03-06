/**
 * PROGRESS CALCULATION UTILITIES
 * ==============================
 * This is the SINGLE SOURCE OF TRUTH for all progress calculations.
 * All pages (Dashboard, Goals, Analytics, Habits, Tasks) MUST use these functions.
 * 
 * DO NOT duplicate formulas anywhere else in the codebase.
 * 
 * ============================================
 * CORE RULES (NON-NEGOTIABLE)
 * ============================================
 * 1. COMPLETION VS PROGRESS
 *    - Completion (counts) remains binary (100% only)
 *    - Progress is weight-based with completion factors (0/25/50/75/100 → 0/0.25/0.5/0.75/1)
 * 
 * 2. WEIGHT SYSTEM
 *    - High-Value Task (high)     → 3 points  
 *    - Medium-Value Task          → 2 points
 *    - Low-Value Task             → 1 point
 *    - Habit Completion           → 1 point (per valid interval)
 * 
 * 3. WEIGHTED PROGRESS (TIME-SCOPED)
 *    - Planned Weight = sum(priority weights in scope)
 *    - Earned Weight = sum(priority weight × completion factor)
 *    - Progress % = (Earned / Planned) × 100
 *    - Completion Rate = completed_count ÷ total_count (informational, binary)
 * 
 * 4. HABIT CONSISTENCY (SEPARATE FROM TASKS)
 *    - Consistency % = completed_habit_days ÷ expected_days
 *    - Never mix into task completion stats
 * 
 * 5. TIME-SCOPING
 *    - Daily:   Today only
 *    - Weekly:  Last 7 days (rolling window)
 *    - Monthly: Current calendar month
 *    - Quarterly: Current calendar quarter
 *    - Yearly:  Current calendar year
 *    - Ranges end at today (no future dates)
 * 
 * ============================================
 * WHAT NOT TO INCLUDE
 * ============================================
 * - NO fixed task-habit percentage split (e.g., "85.7% tasks + 14.3% habits")
 * - NO goal progress percentages on dashboard
 * - NO time-based contribution in overall progress
 * - NO lifetime totals on dashboard (always time-scoped)
 * - NO partial task credit toward completion (binary only)
 */

import {
  parseISO,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  subDays,
  addDays,
  differenceInDays,
  eachDayOfInterval,
  format,
  isToday
} from 'date-fns'
import type { Task, Goal, Habit, HabitCompletion } from '@/types'
import { getDailyProgress, isTaskPausedOnDate } from '@/lib/daily-reset'
import { getLocalDateString } from '@/lib/database'
import {
  calculateHabitStreaks,
  countHabitCompletedPeriods,
  countHabitTotalPeriods,
} from '@/lib/habit-streaks'

// ============================================
// CONSTANTS (Single Source of Truth)
// ============================================

/**
 * Priority weight mapping for tasks.
 * These values are NON-NEGOTIABLE and must be used consistently across all modules.
 * 
 * 3-TIER PRIORITY SYSTEM:
 * - HIGH   → weight 3 (highest priority tasks)
 * - MEDIUM → weight 2 (standard tasks)
 * - LOW    → weight 1 (low-priority tasks)
 * 
 * @example
 * const taskWeight = PRIORITY_WEIGHTS[task.priority] || 1
 */
export const PRIORITY_WEIGHTS: Record<string, number> = {
  high: 3,      // High-priority tasks
  medium: 2,    // Standard tasks
  low: 1        // Low-priority tasks
}

// Completion factor mapping: 0%, 25%, 50%, 75%, 100%
const getCompletionFactor = (progress: number | undefined | null): number => {
  const value = Math.max(0, Math.min(progress ?? 0, 100))
  if (value >= 100) return 1
  if (value >= 75) return 0.75
  if (value >= 50) return 0.5
  if (value >= 25) return 0.25
  return 0
}

/**
 * Weight assigned to each habit completion.
 * Habits contribute uniformly regardless of frequency.
 */
export const HABIT_WEIGHT = 1

// ============================================
// HABIT DATE ENABLING RULE (Single Source of Truth)
// ============================================

/**
 * Determines if a date should be markable for a habit.
 * 
 * RULE:
 * - If habit was created TODAY: Only today's date is markable
 * - If habit was created EARLIER: All dates from creation date to today are markable
 * - All dates BEFORE creation are disabled
 * - All FUTURE dates are disabled
 * 
 * Applied to:
 * - Monthly Overview table
 * - Habit cards
 * - Streak, consistency, and analytics calculations
 * 
 * @param dateToCheck - The date to evaluate for marking
 * @param habitCreatedAt - ISO string of when the habit was created
 * @returns true if date is markable, false if disabled
 * @example
 * isDateMarkableForHabit(new Date('2024-11-10'), '2024-11-04T10:00:00Z') // true (within range)
 * isDateMarkableForHabit(new Date('2024-11-03'), '2024-11-04T10:00:00Z') // false (before creation)
 * isDateMarkableForHabit(new Date('2024-11-11'), '2024-11-10T10:00:00Z') // false (habit created today, can't mark future)
 */
export const isDateMarkableForHabit = (
  dateToCheck: Date,
  habitCreatedAt: string | undefined
): boolean => {
  if (!habitCreatedAt) return false
  
  const today = startOfDay(new Date())
  const yesterday = startOfDay(subDays(today, 1))
  const dateDay = startOfDay(dateToCheck)
  const createdDay = startOfDay(parseISO(habitCreatedAt))
  
  // Cannot mark future dates
  if (dateDay > today) return false
  
  // Cannot mark dates before habit creation
  if (dateDay < createdDay) return false

  // Only today and one previous day are markable
  if (dateDay.getTime() !== today.getTime() && dateDay.getTime() !== yesterday.getTime()) {
    return false
  }

  // If habit was created today, previous day must remain disabled
  if (createdDay.getTime() === today.getTime() && dateDay.getTime() === yesterday.getTime()) {
    return false
  }
  
  // Date is within valid range (today or yesterday) and respects creation boundary
  return true
}

// ============================================
// HABIT STREAK CALCULATION (Single Source of Truth)
// ============================================

/**
 * Calculates the current streak based on completed periods per habit.
 *
 * STREAK RULES:
 * - Streaks count only completed periods (day/week/month) after 12:00 AM.
 * - Weekly/monthly habits count once per period.
 * - The returned value is the MAX current streak across active habits.
 *
 * @param habits - Array of habits to check
 * @param habitCompletions - Completion history from database
 * @returns Current streak across habits
 */
export const calculateCurrentHabitStreak = (
  habits: Habit[],
  habitCompletions: HabitCompletion[]
): number => {
  const dailyHabits = habits.filter((habit) => !habit.deleted_at && habit.frequency === 'daily')
  if (dailyHabits.length === 0) return 0

  const today = startOfDay(new Date())
  const yesterday = startOfDay(subDays(today, 1))
  const earliestCreation = dailyHabits
    .map((habit) => startOfDay(parseISO(habit.created_at)).getTime())
    .reduce((min, timestamp) => Math.min(min, timestamp), yesterday.getTime())

  if (earliestCreation > yesterday.getTime()) return 0

  const completionKeys = new Set(
    habitCompletions
      .filter((completion) => completion.completed)
      .map((completion) => `${completion.habit_id}:${completion.date.slice(0, 10)}`)
  )

  const isDayCompleted = (day: Date): boolean => {
    const dayKey = format(day, 'yyyy-MM-dd')
    const activeHabitsForDay = dailyHabits.filter(
      (habit) => startOfDay(parseISO(habit.created_at)).getTime() <= day.getTime()
    )

    if (activeHabitsForDay.length === 0) return false

    return activeHabitsForDay.every((habit) => completionKeys.has(`${habit.id}:${dayKey}`))
  }

  let streak = 0
  let cursor = yesterday

  while (cursor.getTime() >= earliestCreation) {
    if (!isDayCompleted(cursor)) break
    streak += 1
    cursor = startOfDay(subDays(cursor, 1))
  }

  return streak
}

/**
 * Calculates the longest streak based on completed periods per habit.
 *
 * The returned value is the MAX longest streak across active habits.
 *
 * @param habits - Array of habits
 * @param habitCompletions - Completion history
 * @returns Longest streak achieved across habits
 */
export const calculateLongestHabitStreak = (
  habits: Habit[],
  habitCompletions: HabitCompletion[]
): number => {
  const dailyHabits = habits.filter((habit) => !habit.deleted_at && habit.frequency === 'daily')
  if (dailyHabits.length === 0) return 0

  const today = startOfDay(new Date())
  const yesterday = startOfDay(subDays(today, 1))
  const earliestCreation = dailyHabits
    .map((habit) => startOfDay(parseISO(habit.created_at)).getTime())
    .reduce((min, timestamp) => Math.min(min, timestamp), yesterday.getTime())

  if (earliestCreation > yesterday.getTime()) return 0

  const completionKeys = new Set(
    habitCompletions
      .filter((completion) => completion.completed)
      .map((completion) => `${completion.habit_id}:${completion.date.slice(0, 10)}`)
  )

  const isDayCompleted = (day: Date): boolean => {
    const dayKey = format(day, 'yyyy-MM-dd')
    const activeHabitsForDay = dailyHabits.filter(
      (habit) => startOfDay(parseISO(habit.created_at)).getTime() <= day.getTime()
    )

    if (activeHabitsForDay.length === 0) return false

    return activeHabitsForDay.every((habit) => completionKeys.has(`${habit.id}:${dayKey}`))
  }

  let longest = 0
  let running = 0
  let cursor = new Date(earliestCreation)

  while (cursor.getTime() <= yesterday.getTime()) {
    if (isDayCompleted(cursor)) {
      running += 1
      if (running > longest) longest = running
    } else {
      running = 0
    }
    cursor = startOfDay(addDays(cursor, 1))
  }

  return longest
}

/**
 * Calculates all-time check-ins (completed vs total possible).
 *
 * Check-ins are counted per habit period:
 * - Daily habits: 1 per day
 * - Weekly habits: 1 per week
 * - Monthly habits: 1 per month
 *
 * @param habits - Habits to calculate for
 * @param habitCompletions - Completion history
 * @returns { completed, total }
 */
export const calculateCheckInsStats = (
  habits: Habit[],
  habitCompletions: HabitCompletion[]
): { completed: number; total: number } => {
  const activeHabits = habits.filter((habit) => !habit.deleted_at)

  let completed = 0
  let total = 0

  activeHabits.forEach((habit) => {
    completed += countHabitCompletedPeriods(habit, habitCompletions)
    total += countHabitTotalPeriods(habit)
  })

  return { completed, total }
}

export interface HabitDueDayMetrics {
  date: string
  fullDate: string
  dueHabits: number
  completedDueHabits: number
  earlyCompletedHabits: number
  consistency: number
}

const getHabitScheduleValues = (habit: Habit): string[] => {
  const raw = (habit as any)?.schedule
  if (Array.isArray(raw)) {
    return raw.map((value) => `${value}`.toLowerCase())
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((value) => `${value}`.toLowerCase())
      }
    } catch {
      return []
    }
  }

  return []
}

const buildHabitCompletionDateMap = (habitCompletions: HabitCompletion[]): Map<string, string[]> => {
  const datesByHabit = new Map<string, Set<string>>()

  habitCompletions.forEach((completion) => {
    if (!completion.completed || !completion.habit_id || !completion.date) return
    const dateKey = completion.date.slice(0, 10)
    if (!datesByHabit.has(completion.habit_id)) {
      datesByHabit.set(completion.habit_id, new Set<string>())
    }
    datesByHabit.get(completion.habit_id)!.add(dateKey)
  })

  const normalized = new Map<string, string[]>()
  datesByHabit.forEach((dateSet, habitId) => {
    normalized.set(habitId, Array.from(dateSet).sort())
  })

  return normalized
}

const hasCompletionBetween = (
  completionDateMap: Map<string, string[]>,
  habitId: string,
  startKey: string,
  endKey: string
): boolean => {
  const dates = completionDateMap.get(habitId)
  if (!dates || dates.length === 0) return false
  return dates.some((dateKey) => dateKey >= startKey && dateKey <= endKey)
}

const getWeeklyDueDayIndex = (): number => {
  return 0 // Sunday
}

const getMonthlyDueDay = (habit: Habit, referenceDay: Date): number => {
  const scheduleValues = getHabitScheduleValues(habit)
  const scheduledDate = scheduleValues
    .map((value) => Number.parseInt(value, 10))
    .find((value) => Number.isFinite(value) && value >= 1 && value <= 31)

  const daysInMonth = new Date(referenceDay.getFullYear(), referenceDay.getMonth() + 1, 0).getDate()
  if (scheduledDate && Number.isFinite(scheduledDate)) {
    return Math.min(scheduledDate, daysInMonth)
  }

  return daysInMonth
}

const getHabitDueWindowForDay = (
  habit: Habit,
  day: Date
): { periodStartKey: string; dueDateKey: string } | null => {
  const dayKey = format(day, 'yyyy-MM-dd')

  if (habit.frequency === 'daily') {
    return {
      periodStartKey: dayKey,
      dueDateKey: dayKey,
    }
  }

  if (habit.frequency === 'weekly') {
    const weekStart = startOfWeek(day, { weekStartsOn: 1 })
    const weekStartOffset = (getWeeklyDueDayIndex() + 6) % 7
    const dueDate = addDays(weekStart, weekStartOffset)
    return {
      periodStartKey: format(weekStart, 'yyyy-MM-dd'),
      dueDateKey: format(dueDate, 'yyyy-MM-dd'),
    }
  }

  const dueDayOfMonth = getMonthlyDueDay(habit, day)
  const dueDate = new Date(day.getFullYear(), day.getMonth(), dueDayOfMonth)
  const periodStart = new Date(day.getFullYear(), day.getMonth(), 1)
  return {
    periodStartKey: format(periodStart, 'yyyy-MM-dd'),
    dueDateKey: format(dueDate, 'yyyy-MM-dd'),
  }
}

export const calculateHabitDueMetricsForDay = (
  habits: Habit[],
  habitCompletions: HabitCompletion[],
  day: Date,
  displayFormat: 'short' | 'medium' | 'long' = 'medium'
): HabitDueDayMetrics => {
  const dayStart = startOfDay(day)
  const dayKey = format(dayStart, 'yyyy-MM-dd')
  const completionDateMap = buildHabitCompletionDateMap(habitCompletions)

  let dueHabits = 0
  let completedDueHabits = 0
  let earlyCompletedHabits = 0

  habits.forEach((habit) => {
    if (!habit || habit.deleted_at) return

    let createdAt: Date
    try {
      createdAt = startOfDay(parseISO(habit.created_at))
    } catch {
      createdAt = dayStart
    }

    if (createdAt > dayStart) return

    const dueWindow = getHabitDueWindowForDay(habit, dayStart)
    if (!dueWindow) return

    if (habit.frequency === 'daily') {
      dueHabits += 1
      if (hasCompletionBetween(completionDateMap, habit.id, dayKey, dayKey)) {
        completedDueHabits += 1
      }
      return
    }

    if (dayKey < dueWindow.dueDateKey) {
      if (hasCompletionBetween(completionDateMap, habit.id, dueWindow.periodStartKey, dayKey)) {
        earlyCompletedHabits += 1
      }
      return
    }

    if (dayKey === dueWindow.dueDateKey) {
      dueHabits += 1
      if (hasCompletionBetween(completionDateMap, habit.id, dueWindow.periodStartKey, dueWindow.dueDateKey)) {
        completedDueHabits += 1
      }
    }
  })

  let displayDate = format(dayStart, 'MMM d')
  if (displayFormat === 'short') displayDate = format(dayStart, 'EEE')
  if (displayFormat === 'long') displayDate = format(dayStart, 'MMM d, yyyy')

  return {
    date: displayDate,
    fullDate: dayKey,
    dueHabits,
    completedDueHabits,
    earlyCompletedHabits,
    consistency: dueHabits > 0 ? Math.round((completedDueHabits / dueHabits) * 100) : 0,
  }
}

export const calculateHabitDueSeries = (
  habits: Habit[],
  habitCompletions: HabitCompletion[],
  dateRange: DateRange,
  displayFormat: 'short' | 'medium' | 'long' = 'medium'
): HabitDueDayMetrics[] => {
  const days = eachDayOfInterval({
    start: startOfDay(dateRange.start),
    end: endOfDay(dateRange.end),
  })

  return days.map((day) => calculateHabitDueMetricsForDay(habits, habitCompletions, day, displayFormat))
}

// ============================================
// HABIT DISPLAY AND RESET LOGIC (Single Source of Truth)
// ============================================

/**
 * Determines if a habit should appear in Today's Progress based on its frequency and completion status.
 * 
 * RULES:
 * - Daily habits: Always show in Today's Progress
 * - Weekly habits: Show every day until completed for the week
 * - Monthly habits: Show EVERY day until completed, then hide until next month
 * 
 * @param habit - The habit to check
 * @param habitCompletions - Completion history from database
 * @returns true if habit should display in Today's Progress
 */
export const shouldHabitDisplayInTodaysProgress = (
  habit: Habit,
  habitCompletions: HabitCompletion[]
): boolean => {
  if (!habit || habit.deleted_at) return false

  const today = new Date()

  // Daily habits: always show
  if (habit.frequency === 'daily') return true

  // Weekly habits: show every day until completed this week
  if (habit.frequency === 'weekly') {
    // Check: has this habit been completed this week?
    const weekStart = startOfDay(getWeekStartDate(today))
    const weekEnd = endOfDay(today)
    
    const completedThisWeek = habitCompletions.some(hc => 
      hc.habit_id === habit.id &&
      hc.completed &&
      isWithinInterval(parseISO(hc.date), { start: weekStart, end: weekEnd })
    )

    return !completedThisWeek // Show only if NOT completed this week
  }

  // Monthly habits: show every day until completed, then hide until next month
  if (habit.frequency === 'monthly') {
    const monthStart = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1))
    const monthEnd = endOfDay(today)

    const completedThisMonth = habitCompletions.some(hc =>
      hc.habit_id === habit.id &&
      hc.completed &&
      isWithinInterval(parseISO(hc.date), { start: monthStart, end: monthEnd })
    )

    return !completedThisMonth // Show only if NOT completed this month
  }

  return false
}

/**
 * Gets the start date of the current week (Monday).
 * 
 * @param date - The date to find the week start for (default: today)
 * @returns Date representing Monday of the week
 */
export const getWeekStartDate = (date: Date = new Date()): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const daysSinceMonday = (day + 6) % 7
  const diff = d.getDate() - daysSinceMonday
  return new Date(d.setDate(diff))
}

/**
 * Gets the end date of the current week (Sunday).
 * 
 * @param date - The date to find the week end for (default: today)
 * @returns Date representing Sunday of the week
 */
export const getWeekEndDate = (date: Date = new Date()): Date => {
  const weekStart = getWeekStartDate(date)
  return addDays(weekStart, 6)
}

/**
 * Determines if a weekly habit should reset today.
 * Weekly habits reset on Monday (start of new week).
 * 
 * @param date - The date to check (default: today)
 * @returns true if today is Monday (start of new week)
 */
export const shouldWeeklyHabitResetToday = (date: Date = new Date()): boolean => {
  // Weekly cycle resets at Monday 12:00 AM
  return format(date, 'EEEE').toLowerCase() === 'monday'
}

/**
 * Determines if a monthly habit should reset today.
 * Monthly habits reset on the 1st of each month.
 * 
 * @param date - The date to check (default: today)
 * @returns true if today is the 1st of the month
 */
export const shouldMonthlyHabitResetToday = (date: Date = new Date()): boolean => {
  return date.getDate() === 1
}

// ============================================
// DAILY PROGRESS CALCULATION (Single Source of Truth)
// ============================================

/**
 * Calculates today's progress based on completed tasks and habits.
 * 
 * Progress uses completion factors (0/25/50/75/100 → 0/0.25/0.5/0.75/1)
 * - Weighted task progress = earned_weight / planned_weight
 * - Completion rate remains a binary informational count (100% only)
 * - Habit consistency is SEPARATE from task progress
 *
 * Formula:
 * - Planned task weight: sum(priority weight) for today's tasks
 * - Earned task weight: sum(priority weight × completion factor)
 * - Tasks completion rate: count(100% tasks) / total tasks (informational)
 * - Habits: binary consistency for scheduled habits
 * - Display: weighted task progress and habit consistency
 * 
 * @param tasks - All tasks from the store
 * @param habits - All habits from the store (with today_completed flag if available)
 * @returns Object with task weight, habit counts, and consistency
 */
export interface DailyProgressMetrics {
  earnedTaskWeight: number
  totalTaskWeight: number
  completedTaskCount: number
  totalTaskCount: number
  completedHabitCount: number
  totalHabitCount: number
  habitConsistency: number // percentage
  taskCompletionRate: number // percentage (binary)
  weightedTaskProgress: number // percentage (weight-based partial credit)
}

export const calculateDailyProgress = (tasks: Task[], habits: Habit[]): DailyProgressMetrics => {
  const today = new Date()
  
  // Filter tasks that are due today (EXCLUDE PAUSED TASKS - they don't affect progress)
  const todaysTasks = tasks.filter(t => {
    if (t.deleted_at) return false
    if (isTaskPausedOnDate(t, today)) return false // Paused tasks are frozen for this day
    if (t.due_date) {
      try {
        const dueDate = parseISO(t.due_date)
        if (isToday(dueDate)) return true
      } catch {}
    }
    // Also include tasks completed today (even if not originally due today)
    if (t.completed_at) {
      try {
        const completedDate = parseISO(t.completed_at)
        if (isToday(completedDate)) return true
      } catch {}
    }
    return false
  })
  
  // Planned/earned weight with completion factors
  const totalTaskWeight = todaysTasks.reduce((sum, t) => sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0)
  const earnedTaskWeight = todaysTasks.reduce((sum, t) => {
    const weight = PRIORITY_WEIGHTS[t.priority] || 1
    return sum + weight * getCompletionFactor(t.progress)
  }, 0)
  const completedTaskCount = todaysTasks.filter(t => (t.progress || 0) === 100).length
  
  // Filter daily habits (habits that should be done today)
  const dayOfWeek = format(today, 'EEEE').toLowerCase()
  const todaysHabits = habits.filter(h => {
    if (h.deleted_at) return false
    if (h.frequency === 'daily') return true
    if (h.frequency === 'weekly' && h.schedule) {
      const schedule = typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
      return Array.isArray(schedule) && schedule.some(s => s.toLowerCase() === dayOfWeek)
    }
    return false
  })
  
  // Habit completion: check today_completed flag from habit_completions table
  const completedHabitCount = todaysHabits.filter(h => {
    if ('today_completed' in h && typeof h.today_completed === 'boolean') {
      return h.today_completed
    }
    return false
  }).length
  
  const totalHabitCount = todaysHabits.length
  
  // Calculate rates (BINARY: either completed or not)
  const taskCompletionRate = todaysTasks.length > 0
    ? Math.round((completedTaskCount / todaysTasks.length) * 100)
    : 0
    
  const habitConsistency = todaysHabits.length > 0
    ? Math.round((completedHabitCount / todaysHabits.length) * 100)
    : 0
  
  const weightedTaskProgress = totalTaskWeight > 0
    ? Math.round((earnedTaskWeight / totalTaskWeight) * 100)
    : 0
  
  return {
    earnedTaskWeight,
    totalTaskWeight,
    completedTaskCount,
    totalTaskCount: todaysTasks.length,
    completedHabitCount,
    totalHabitCount,
    habitConsistency,
    taskCompletionRate,
    weightedTaskProgress
  }
}

export type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface DateRange {
  start: Date
  end: Date
}

// ============================================
// DATE RANGE HELPERS
// ============================================

export const getDateRange = (range: TimeRange): DateRange => {
  const today = new Date()
  const end = endOfDay(today)
  let start: Date

  switch (range) {
    case 'day':
      start = startOfDay(today)
      break
    case 'week':
      start = startOfDay(subDays(today, 6))
      break
    case 'month':
      start = startOfMonth(today)
      break
    case 'quarter':
      start = startOfQuarter(today)
      break
    case 'year':
      start = startOfYear(today)
      break
    default:
      start = startOfMonth(today)
  }

  return { start, end }
}

/**
 * Returns the full calendar period range for display purposes.
 * Unlike getDateRange which ends at today for data calculations,
 * this shows the complete period (e.g., Feb 1-28 even if today is Feb 27).
 */
export const getDateRangeDisplay = (range: TimeRange): DateRange => {
  const today = new Date()
  let start: Date
  let end: Date

  switch (range) {
    case 'day':
      start = startOfDay(today)
      end = endOfDay(today)
      break
    case 'week':
      start = startOfDay(subDays(today, 6))
      end = endOfDay(today)
      break
    case 'month':
      start = startOfMonth(today)
      end = endOfMonth(today)
      break
    case 'quarter':
      start = startOfQuarter(today)
      end = endOfQuarter(today)
      break
    case 'year':
      start = startOfYear(today)
      end = endOfYear(today)
      break
    default:
      start = startOfMonth(today)
      end = endOfMonth(today)
  }

  return { start, end }
}

export const isInRange = (dateStr: string | undefined | null, range: DateRange): boolean => {
  if (!dateStr) return false
  try {
    const date = parseISO(dateStr)
    return isWithinInterval(date, { start: range.start, end: range.end })
  } catch {
    return false
  }
}

// ============================================
// TASK ANALYTICS (Single Source of Truth)
// ============================================

export interface TaskAnalytics {
  total: number
  completed: number
  pending: number
  inProgress: number
  partiallyCompleted: number
  blocked: number
  skipped: number
  overdue: number
  totalWeight: number
  earnedWeight: number
  weightedCompletionRate: number
  weightedProgress: number
  simpleCompletionRate: number
  byPriority: {
    high: Task[]
    medium: Task[]
    low: Task[]
  }
  completedByPriority: {
    high: number
    medium: number
    low: number
  }
  totalEstimatedTime: number
  totalActualTime: number
  avgCompletionTime: number
}

export const calculateTaskAnalytics = (
  tasks: Task[], 
  dateRange?: DateRange
): TaskAnalytics => {
  // ⚠️ CRITICAL DATA INTEGRITY:
  // This function calculates stats from ALL tasks in the database, regardless of UI visibility
  // Tasks that have aged out of "Today" or "Yesterday" sections are STILL COUNTED here
  // Stats = history of actions, not current UI lists
  
  // Filter tasks by date range if provided
  // CRITICAL: Filter by due_date (when task is due), not created_at (when it was created)
  // This ensures weekly/monthly/quarterly analytics show relevant tasks for that period
  // CRITICAL: EXCLUDE PAUSED TASKS - they are completely frozen and don't affect progress/analytics
  const filteredTasks = tasks
    .filter(t => {
      if (!dateRange) return !isTaskPausedOnDate(t, new Date())

      // Use daily history to determine existence in range; fallback to due_date
      const dates = t.daily_progress ? Object.keys(t.daily_progress) : []
      const historyDatesInRange = dates
        .filter(dateKey => isInRange(dateKey, dateRange))
        .sort()

      if (historyDatesInRange.length > 0) {
        const latestNonPaused = [...historyDatesInRange]
          .reverse()
          .find(dateKey => !isTaskPausedOnDate(t, parseISO(dateKey)))
        return !!latestNonPaused
      }

      if (t.due_date && isInRange(t.due_date, dateRange)) {
        return !isTaskPausedOnDate(t, parseISO(t.due_date))
      }

      return false
    })
  
  // CRITICAL: Task completion rule - progress === 100% or status = 'completed' means completed
  const completedTasks = filteredTasks.filter(t => 
    t.status === 'completed' || t.progress === 100
  )
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending')
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress' || (t.progress > 0 && t.progress < 100))
  const partiallyCompletedTasks = filteredTasks.filter(t => 
    t.progress && t.progress > 0 && t.progress < 100 && t.status !== 'completed'
  )
  const blockedTasks = filteredTasks.filter(t => t.status === 'blocked')

  const todayKey = getLocalDateString(new Date())

  const toDayKey = (value?: string | null): string => {
    if (!value) return todayKey
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    return getLocalDateString(parseISO(value))
  }

  const isSkippedOrEmptyEntry = (entry: { progress?: number | null; status?: string | null }) => {
    const status = entry.status || 'pending'
    const progress = entry.progress ?? 0
    return status === 'skipped' || (progress <= 0 && status !== 'completed')
  }

  const taskExistsOnDay = (task: Task, dayKey: string) => {
    const createdKey = toDayKey(task.created_at)
    if (createdKey > dayKey) return false
    if (task.duration_type === 'continuous') return true
    return createdKey === dayKey
  }

  const getEntryForDay = (task: Task, dayKey: string) => {
    const historyEntry = task.daily_progress?.[dayKey]
    if (historyEntry) {
      return {
        progress: historyEntry.progress ?? 0,
        status: historyEntry.status ?? 'pending',
      }
    }

    if (dayKey === todayKey) {
      return {
        progress: task.progress ?? 0,
        status: task.status ?? 'pending',
      }
    }

    return {
      progress: 0,
      status: 'pending',
    }
  }
  
  // Planned vs earned weight using completion factors
  const totalWeight = filteredTasks.reduce((sum, t) => 
    sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0
  )
  const earnedWeight = filteredTasks.reduce((sum, t) => {
    const weight = PRIORITY_WEIGHTS[t.priority] || 1

    // Pull progress from history if in range, otherwise use current progress
    const effectiveProgress = (() => {
      if (!dateRange) return t.progress
      const dates = Object.keys(t.daily_progress || {})
        .filter(dateKey => isInRange(dateKey, dateRange))
        .sort()
      if (dates.length === 0) return t.progress
      // Use the latest non-paused date within range
      const latest = [...dates]
        .reverse()
        .find(dateKey => !isTaskPausedOnDate(t, parseISO(dateKey)))
      if (!latest) return 0
      return getDailyProgress(t, parseISO(latest))
    })()

    return sum + weight * getCompletionFactor(effectiveProgress)
  }, 0)
  const weightedProgress = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0
  const weightedCompletionRate = weightedProgress
  
  // Simple completion rate (unweighted)
  const simpleCompletionRate = filteredTasks.length > 0
    ? Math.round((completedTasks.length / filteredTasks.length) * 100)
    : 0
  
  // Priority breakdown
  const byPriority = {
    high: filteredTasks.filter(t => t.priority === 'high'),
    medium: filteredTasks.filter(t => t.priority === 'medium'),
    low: filteredTasks.filter(t => t.priority === 'low')
  }
  
  const completedByPriority = {
    high: completedTasks.filter(t => t.priority === 'high').length,
    medium: completedTasks.filter(t => t.priority === 'medium').length,
    low: completedTasks.filter(t => t.priority === 'low').length
  }
  
  // Time estimates
  const totalEstimatedTime = filteredTasks.reduce((sum, t) => sum + (t.estimated_time || 0), 0)
  const totalActualTime = completedTasks.reduce((sum, t) => sum + (t.actual_time || 0), 0)
  
  // Overdue tasks: due-day only, finalized days only, and only skipped/empty outcomes.
  const overdueTasks = filteredTasks.filter(t => {
    if (!t.due_date) return false
    const dueKey = toDayKey(t.due_date)
    if (dueKey >= todayKey) return false
    if (dateRange && !isInRange(dueKey, dateRange)) return false
    if (!taskExistsOnDay(t, dueKey)) return false
    if (isTaskPausedOnDate(t, parseISO(`${dueKey}T00:00:00`))) return false
    const dueEntry = getEntryForDay(t, dueKey)
    return isSkippedOrEmptyEntry(dueEntry)
  })

  // Skipped: count tasks that have at least one finalized skipped/empty day in scope.
  const skippedTasks = filteredTasks.filter(t => {
    const dayCandidates = new Set<string>()

    Object.keys(t.daily_progress || {}).forEach((dayKey) => {
      if (dayKey < todayKey && (!dateRange || isInRange(dayKey, dateRange))) {
        dayCandidates.add(dayKey)
      }
    })

    const dueKey = t.due_date ? toDayKey(t.due_date) : null
    if (dueKey && dueKey < todayKey && (!dateRange || isInRange(dueKey, dateRange))) {
      dayCandidates.add(dueKey)
    }

    const createdKey = toDayKey(t.created_at)
    if (createdKey < todayKey && (!dateRange || isInRange(createdKey, dateRange))) {
      dayCandidates.add(createdKey)
    }

    for (const dayKey of dayCandidates) {
      if (!taskExistsOnDay(t, dayKey)) continue
      if (isTaskPausedOnDate(t, parseISO(`${dayKey}T00:00:00`))) continue
      const entry = getEntryForDay(t, dayKey)
      if (isSkippedOrEmptyEntry(entry)) return true
    }

    return false
  })
  
  return {
    total: filteredTasks.length,
    completed: completedTasks.length,
    pending: pendingTasks.length,
    inProgress: inProgressTasks.length,
    partiallyCompleted: partiallyCompletedTasks.length,
    blocked: blockedTasks.length,
    skipped: skippedTasks.length,
    overdue: overdueTasks.length,
    totalWeight,
    earnedWeight,
    weightedCompletionRate,
    weightedProgress,
    simpleCompletionRate,
    byPriority,
    completedByPriority,
    totalEstimatedTime,
    totalActualTime,
    avgCompletionTime: completedTasks.length > 0 
      ? Math.round(totalActualTime / completedTasks.length) 
      : 0
  }
}

// ============================================
// HABIT ANALYTICS (Single Source of Truth)
// ============================================

export interface HabitAnalytics {
  total: number
  newInRange?: number
  expectedPeriods: number
  completedPeriods: number
  completedHabitsCount: number
  totalCurrentStreak: number
  totalLongestStreak: number
  avgConsistency: number
  maxStreak: number
  totalHabitWeight: number
  topHabits: Habit[]
  strugglingHabits: Habit[]
  byFrequency: {
    daily: Habit[]
    weekly: Habit[]
    monthly: Habit[]
  }
}

export const calculateHabitAnalytics = (
  habits: Habit[],
  dateRange?: DateRange,
  habitCompletions: HabitCompletion[] = []
): HabitAnalytics => {
  // Filter habits: include all NOT deleted AND created before or during the range
  const activeHabits = dateRange
    ? habits.filter(h => !h.deleted_at && parseISO(h.created_at) <= dateRange.end)
    : habits.filter(h => !h.deleted_at)

  const completionsByHabit = new Map<string, HabitCompletion[]>()
  activeHabits.forEach((habit) => completionsByHabit.set(habit.id, []))

  habitCompletions.forEach((completion) => {
    if (!completion.completed) return
    if (!completionsByHabit.has(completion.habit_id)) return

    const completionDate = parseISO(completion.date)
    if (dateRange && completionDate > dateRange.end) return

    completionsByHabit.get(completion.habit_id)!.push(completion)
  })

  const completionDateMap = buildHabitCompletionDateMap(habitCompletions)

  let expectedPeriods = 0
  let completedPeriods = 0
  const completedHabits = new Set<string>()
  const consistencyByHabit = new Map<string, number>()
  const expectedByHabit = new Map<string, number>()
  const habitsWithDuePeriods: Habit[] = []

  activeHabits.forEach((habit) => {
    const createdAt = startOfDay(parseISO(habit.created_at))
    const effectiveStart = dateRange
      ? (createdAt > startOfDay(dateRange.start) ? createdAt : startOfDay(dateRange.start))
      : createdAt
    const effectiveEnd = dateRange ? endOfDay(dateRange.end) : endOfDay(new Date())

    if (effectiveStart > effectiveEnd) {
      consistencyByHabit.set(habit.id, 0)
      return
    }

    let habitExpectedPeriods = 0
    let habitCompletedPeriods = 0
    const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd })

    days.forEach((day) => {
      const dayKey = format(day, 'yyyy-MM-dd')
      const dueWindow = getHabitDueWindowForDay(habit, day)
      if (!dueWindow) return

      if (habit.frequency === 'daily') {
        habitExpectedPeriods += 1
        if (hasCompletionBetween(completionDateMap, habit.id, dayKey, dayKey)) {
          habitCompletedPeriods += 1
        }
        return
      }

      if (dayKey !== dueWindow.dueDateKey) return

      habitExpectedPeriods += 1
      if (hasCompletionBetween(completionDateMap, habit.id, dueWindow.periodStartKey, dueWindow.dueDateKey)) {
        habitCompletedPeriods += 1
      }
    })

    expectedByHabit.set(habit.id, habitExpectedPeriods)
    expectedPeriods += habitExpectedPeriods
    completedPeriods += habitCompletedPeriods

    if (habitCompletedPeriods > 0) {
      completedHabits.add(habit.id)
    }

    const consistency = habitExpectedPeriods > 0
      ? Math.round((habitCompletedPeriods / habitExpectedPeriods) * 100)
      : 0
    consistencyByHabit.set(habit.id, consistency)

    if (habitExpectedPeriods > 0) {
      habitsWithDuePeriods.push(habit)
    }
  })

  const streakDate = dateRange ? endOfDay(dateRange.end) : new Date()
  const streaksByHabit = new Map<string, { current: number; longest: number }>()
  activeHabits.forEach((habit) => {
    const streaks = calculateHabitStreaks(habit, completionsByHabit.get(habit.id) || [], streakDate)
    streaksByHabit.set(habit.id, streaks)
  })
  
  // Streak calculations - use MAX for display
  const totalCurrentStreak = activeHabits.length > 0 
    ? Math.max(...activeHabits.map(h => streaksByHabit.get(h.id)?.current || 0))
    : 0
  const totalLongestStreak = activeHabits.length > 0 
    ? Math.max(...activeHabits.map(h => streaksByHabit.get(h.id)?.longest || 0))
    : 0
  
  // Consistency is average across all active habits for the selected range
  const avgConsistency = habitsWithDuePeriods.length > 0
    ? Math.round(habitsWithDuePeriods.reduce((sum, h) => sum + (consistencyByHabit.get(h.id) || 0), 0) / habitsWithDuePeriods.length)
    : 0

  const mergedHabits = activeHabits.map((habit) => ({
    ...habit,
    consistency_score: consistencyByHabit.get(habit.id) || 0,
    streak_current: streaksByHabit.get(habit.id)?.current || 0,
    streak_longest: streaksByHabit.get(habit.id)?.longest || 0,
  }))
  
  // Best performing habits (by consistency)
  const sortedByConsistency = [...mergedHabits].sort((a, b) => 
    (b.consistency_score || 0) - (a.consistency_score || 0)
  )
  const topHabits = sortedByConsistency.slice(0, 5)
  const strugglingHabits = sortedByConsistency
    .filter(h => (expectedByHabit.get(h.id) || 0) > 0 && (h.consistency_score || 0) < 50)
    .slice(0, 5)
  
  // Habit completion weight - completed periods in scope
  const totalHabitWeight = completedPeriods * HABIT_WEIGHT
  
  // By frequency
  const byFrequency = {
    daily: mergedHabits.filter(h => h.frequency === 'daily'),
    weekly: mergedHabits.filter(h => h.frequency === 'weekly'),
    monthly: mergedHabits.filter(h => h.frequency === 'monthly')
  }
  
  // Count habits created within the date range
  const newInRange = dateRange
    ? activeHabits.filter(h => {
        const createdAt = parseISO(h.created_at)
        return createdAt >= dateRange.start && createdAt <= dateRange.end
      }).length
    : 0

  return {
    total: activeHabits.length,
    newInRange,
    expectedPeriods,
    completedPeriods,
    completedHabitsCount: completedHabits.size,
    totalCurrentStreak,
    totalLongestStreak,
    avgConsistency,
    maxStreak: totalLongestStreak,
    totalHabitWeight,
    topHabits,
    strugglingHabits,
    byFrequency
  }
}

// ============================================
// GOAL ANALYTICS (Single Source of Truth)
// ============================================

export interface GoalWithProgress extends Goal {
  linkedTasksCount: number
  completedTasksCount: number
  taskProgress: number
  linkedHabitsCount: number
  avgHabitConsistency: number
  calculatedProgress: number  // The REAL progress based on linked items
}

export interface GoalAnalytics {
  total: number
  active: number
  completed: number
  paused: number
  overdue: number
  newInRange?: number
  completedInRange?: number
  goalsWithProgress: GoalWithProgress[]
  goalsWithTasks: GoalWithProgress[]
  byCategory: {
    career: Goal[]
    health: Goal[]
    learning: Goal[]
    finance: Goal[]
    personal: Goal[]
    custom: Goal[]
  }
  totalLinkedTasks: number
  completedLinkedTasks: number
  linkedTaskCompletionRate: number
  avgGoalProgress: number
}

export const calculateGoalProgress = (
  goal: Goal,
  tasks: Task[],
  habits: Habit[]
): GoalWithProgress => {
  // CRITICAL: Exclude deleted and paused tasks - paused tasks don't affect goal progress
  const linkedTasks = tasks.filter(t => t.goal_id === goal.id && !t.deleted_at && !isTaskPausedOnDate(t, new Date()))
  // CRITICAL: Task completion rule - progress === 100% or status = 'completed'
  const completedTasks = linkedTasks.filter(t => 
    t.status === 'completed' || t.progress === 100
  )
  const linkedHabits = habits.filter(h => h.goal_id === goal.id && !h.deleted_at)
  
  // Calculate task progress (weighted by priority with partial credit)
  const totalTaskWeight = linkedTasks.reduce((sum, t) => 
    sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0
  )
  const earnedTaskWeight = linkedTasks.reduce((sum, t) => {
    const weight = PRIORITY_WEIGHTS[t.priority] || 1
    return sum + weight * getCompletionFactor(t.progress)
  }, 0)
  const taskProgress = totalTaskWeight > 0 
    ? Math.round((earnedTaskWeight / totalTaskWeight) * 100)
    : 0
  
  // Calculate habit consistency
  const avgHabitConsistency = linkedHabits.length > 0
    ? Math.round(linkedHabits.reduce((sum, h) => sum + h.consistency_score, 0) / linkedHabits.length)
    : 0
  
  // Calculate overall goal progress:
  // - If task-based: 100% from tasks (weighted)
  // - If manual: Use stored progress (legacy support)
  // - If both tasks and habits exist: 70% tasks, 30% habits
  let calculatedProgress: number
  
  if (goal.progress_method === 'task-based' || linkedTasks.length > 0) {
    if (linkedHabits.length > 0) {
      // Both tasks and habits: weighted average
      calculatedProgress = Math.round(taskProgress * 0.7 + avgHabitConsistency * 0.3)
    } else {
      // Tasks only
      calculatedProgress = taskProgress
    }
  } else if (linkedHabits.length > 0) {
    // Habits only
    calculatedProgress = avgHabitConsistency
  } else {
    // Manual fallback (for goals with no linked items)
    calculatedProgress = goal.progress || 0
  }
  
  return {
    ...goal,
    linkedTasksCount: linkedTasks.length,
    completedTasksCount: completedTasks.length,
    taskProgress,
    linkedHabitsCount: linkedHabits.length,
    avgHabitConsistency,
    calculatedProgress
  }
}

export const calculateGoalAnalytics = (
  goals: Goal[],
  tasks: Task[],
  habits: Habit[],
  dateRange?: DateRange
): GoalAnalytics => {
  // Filter goals: include all NOT deleted AND created before or during the range
  const filteredGoals = dateRange
    ? goals.filter(g => !g.deleted_at && parseISO(g.created_at) <= dateRange.end)
    : goals.filter(g => !g.deleted_at)
  
  const activeGoals = filteredGoals.filter(g => g.status === 'active')
  const completedGoals = filteredGoals.filter(g => g.status === 'completed')
  const pausedGoals = filteredGoals.filter(g => g.status === 'paused')
  
  // Calculate progress for all goals (use filtered goals)
  const goalsWithProgress = filteredGoals
    .map(g => calculateGoalProgress(g, tasks, habits))
  
  // Goals by category
  const byCategory = {
    career: activeGoals.filter(g => g.category === 'career'),
    health: activeGoals.filter(g => g.category === 'health'),
    learning: activeGoals.filter(g => g.category === 'learning'),
    finance: activeGoals.filter(g => g.category === 'finance'),
    personal: activeGoals.filter(g => g.category === 'personal'),
    custom: activeGoals.filter(g => g.category === 'custom')
  }
  
  // Overdue goals (only from filtered set)
  const overdueGoals = filteredGoals.filter(g => 
    g.status === 'active' && g.target_date && parseISO(g.target_date) < new Date()
  )
  
  // Linked tasks across all goals
  const totalLinkedTasks = tasks.filter(t => t.goal_id && !t.deleted_at).length
  // CRITICAL: Task completion rule - progress === 100% or status = 'completed'
  const completedLinkedTasks = tasks.filter(t => 
    t.goal_id && !t.deleted_at && (t.status === 'completed' || t.progress === 100)
  ).length
  
  // Average goal progress (from calculated progress, not stored)
  const activeGoalsWithProgress = goalsWithProgress.filter(g => g.status === 'active')
  const avgGoalProgress = activeGoalsWithProgress.length > 0
    ? Math.round(activeGoalsWithProgress.reduce((sum, g) => sum + g.calculatedProgress, 0) / activeGoalsWithProgress.length)
    : 0
  
  return {
    total: filteredGoals.length,
    active: activeGoals.length,
    completed: completedGoals.length,
    completedInRange: completedGoals.length,
    newInRange: filteredGoals.length,
    paused: pausedGoals.length,
    overdue: overdueGoals.length,
    goalsWithProgress,
    goalsWithTasks: goalsWithProgress.filter(g => g.linkedTasksCount > 0),
    byCategory,
    totalLinkedTasks,
    completedLinkedTasks,
    linkedTaskCompletionRate: totalLinkedTasks > 0
      ? Math.round((completedLinkedTasks / totalLinkedTasks) * 100)
      : 0,
    avgGoalProgress
  }
}

// ============================================
// TIME ANALYTICS (Single Source of Truth)
// ============================================

export interface TimeAnalytics {
  totalActualTime: number
  totalEstimatedTime: number
  timeEfficiency: number
  daysWithActivity: number
  daysInRange: number
  activityRate: number
  avgDailyTime: number
}

export const calculateTimeAnalytics = (
  tasks: Task[],
  dateRange: DateRange
): TimeAnalytics => {
  // CRITICAL: Exclude paused tasks - they don't affect time analytics
  const completedTasksInRange = tasks.filter(t => 
    !t.deleted_at && 
    !isTaskPausedOnDate(t, dateRange.end) &&
    (t.status === 'completed' || t.progress === 100) &&
    isInRange(t.completed_at, dateRange)
  )
  
  const totalActualTime = completedTasksInRange.reduce((sum, t) => sum + (t.actual_time || 0), 0)
  const totalEstimatedTime = completedTasksInRange.reduce((sum, t) => sum + (t.estimated_time || 0), 0)
  
  // Time efficiency
  const timeEfficiency = totalEstimatedTime > 0
    ? Math.round((totalEstimatedTime / Math.max(totalActualTime, 1)) * 100)
    : 0
  
  // Days with activity
  const daysWithActivity = new Set(
    completedTasksInRange
      .filter(t => t.completed_at)
      .map(t => format(parseISO(t.completed_at!), 'yyyy-MM-dd'))
  ).size
  
  const daysInRange = differenceInDays(dateRange.end, dateRange.start) + 1
  
  return {
    totalActualTime,
    totalEstimatedTime,
    timeEfficiency,
    daysWithActivity,
    daysInRange,
    activityRate: Math.round((daysWithActivity / daysInRange) * 100),
    avgDailyTime: daysWithActivity > 0 ? Math.round(totalActualTime / daysWithActivity) : 0
  }
}

// ============================================
// PRODUCTIVITY SCORE (Single Source of Truth)
// ============================================

const TASK_CATEGORY_WEIGHT = 20
const HABIT_CATEGORY_WEIGHT = 4

const calculateWeightedProductivity = (
  taskCompletion: number,
  habitCompletion: number,
  hasHabits: boolean
): number => {
  if (!hasHabits) {
    return Math.round(taskCompletion)
  }

  const totalCategoryWeight = TASK_CATEGORY_WEIGHT + HABIT_CATEGORY_WEIGHT
  const taskContribution = taskCompletion * TASK_CATEGORY_WEIGHT
  const habitContribution = habitCompletion * HABIT_CATEGORY_WEIGHT
  return Math.round((taskContribution + habitContribution) / totalCategoryWeight)
}

export interface ProductivityScore {
  overall: number
  taskComponent: number
  habitComponent: number
  breakdown: {
    weightedCompletion: number
    habitConsistency: number
    taskWeight: number
    habitWeight: number
    taskCategoryWeight: number
    habitCategoryWeight: number
    hasHabits: boolean
  }
  completedTasks?: number
  completedHabits?: number
}

export interface ProductivityTaskInput {
  weightedCompletionRate: number
  totalWeight: number
}

export interface ProductivityHabitInput {
  avgConsistency: number
  totalHabitWeight: number
  total: number
}

/**
 * Calculates an overall productivity score combining task and habit metrics with dynamic weighting.
 * 
 * Formula:
 * - Task Category Weight: 20 (contribution multiplier for task category)
 * - Habit Category Weight: 4 (contribution multiplier for habit category)
 * - Task Completion %: (earnedWeight / totalWeight) * 100
 * - Habit Completion %: (completedPeriods / expectedPeriods) * 100
 * 
 * Dynamic Distribution:
 * - If habits exist: overall = (taskComp% * 20 + habitComp% * 4) / (20 + 4)
 * - If NO habits: overall = taskComp% (100% of score)
 * - This ensures normalized scores reflect actual performance, not fixed category ratios
 * 
 * @param taskAnalytics - Task metrics from calculateTaskAnalytics
 * @param habitAnalytics - Habit metrics from calculateHabitAnalytics
 * @returns ProductivityScore with overall score, components, and dynamic weighting breakdown
 */
export const calculateProductivityScore = (
  taskAnalytics: ProductivityTaskInput,
  habitAnalytics: ProductivityHabitInput
): ProductivityScore => {
  // Calculate component completion percentages
  const taskCompletion = taskAnalytics.weightedCompletionRate || 0
  const habitCompletion = habitAnalytics.avgConsistency || 0

  // Determine if habits exist in the data
  const hasHabits = habitAnalytics.total > 0

  // Calculate overall productivity score with dynamic weighting
  // Dynamically weight based on category weights
  // "Each category should calculate its own completion percentage relative to its own total weight
  //  and then contribute proportionally to the final productivity score"
  const overall = calculateWeightedProductivity(taskCompletion, habitCompletion, hasHabits)

  return {
    overall,
    taskComponent: taskCompletion,
    habitComponent: habitCompletion,
    breakdown: {
      weightedCompletion: taskAnalytics.weightedCompletionRate,
      habitConsistency: habitAnalytics.avgConsistency,
      taskWeight: taskAnalytics.totalWeight,
      habitWeight: habitAnalytics.totalHabitWeight,
      taskCategoryWeight: TASK_CATEGORY_WEIGHT,
      habitCategoryWeight: HABIT_CATEGORY_WEIGHT,
      hasHabits
    }
  }
}

// ============================================
// TREND DATA (Single Source of Truth)
// ============================================

export interface TrendDataPoint {
  date: string
  fullDate: string
  tasks: number
  completed: number
  partiallyCompleted: number
  skipped: number
  weightedCompleted: number
  habits: number
  habitsCompleted: number
  earlyCompletedHabits: number
  productivity: number
}

export const calculateTrendData = (
  tasks: Task[],
  habits: Habit[],
  habitCompletions: HabitCompletion[],
  dateRange: DateRange,
  displayFormat: 'short' | 'medium' | 'long' = 'medium'
): TrendDataPoint[] => {
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })
  const habitCompletionDateMap = buildHabitCompletionDateMap(habitCompletions)
  
  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd')
    
    let displayDate: string
    switch (displayFormat) {
      case 'short':
        displayDate = format(day, 'EEE')
        break
      case 'long':
        displayDate = format(day, 'MMM d, yyyy')
        break
      default:
        displayDate = format(day, 'MMM d')
    }
    
    // Tasks connected to this day (EXCLUDE PAUSED TASKS)
    // Include task if it has daily history on this day OR was created/completed/due on this day.
    // This keeps Analytics Task charts aligned with Task tab updates and history snapshots.
    const dayTasks = tasks.filter(t => 
      !t.deleted_at && 
      !isTaskPausedOnDate(t, day) &&
      (
        (t.daily_progress && Object.prototype.hasOwnProperty.call(t.daily_progress, dayStr)) ||
        (t.due_date && format(parseISO(t.due_date), 'yyyy-MM-dd') === dayStr) ||
        format(parseISO(t.created_at), 'yyyy-MM-dd') === dayStr ||
        (t.completed_at && format(parseISO(t.completed_at), 'yyyy-MM-dd') === dayStr)
      )
    )

    const dayTaskProgress = (task: Task): number => {
      if (task.daily_progress && Object.prototype.hasOwnProperty.call(task.daily_progress, dayStr)) {
        return getDailyProgress(task, day)
      }

      if (task.completed_at && format(parseISO(task.completed_at), 'yyyy-MM-dd') === dayStr) {
        return 100
      }

      return task.progress || 0
    }
    
    // Earned weight for tasks on this day (partial credit allowed)
    const dayPlannedWeight = dayTasks.reduce((sum, t) => sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0)
    const earnedTaskWeight = dayTasks.reduce((sum, t) => {
      const weight = PRIORITY_WEIGHTS[t.priority] || 1
      return sum + weight * getCompletionFactor(dayTaskProgress(t))
    }, 0)
    
    const completedTasks = dayTasks.filter(t => dayTaskProgress(t) >= 100)
    const partialTasks = dayTasks.filter(t => dayTaskProgress(t) > 0 && dayTaskProgress(t) < 100)
    const skippedTasks = dayTasks.filter(t => dayTaskProgress(t) === 0 || t.status === 'skipped')
    
    let dueHabits = 0
    let habitsCompleted = 0
    let earlyCompletedHabits = 0

    habits.forEach((habit) => {
      if (!habit || habit.deleted_at) return

      let createdAt: Date
      try {
        createdAt = startOfDay(parseISO(habit.created_at))
      } catch {
        createdAt = startOfDay(day)
      }
      if (createdAt > startOfDay(day)) return

      const dueWindow = getHabitDueWindowForDay(habit, day)
      if (!dueWindow) return

      if (habit.frequency === 'daily') {
        dueHabits += 1
        if (hasCompletionBetween(habitCompletionDateMap, habit.id, dayStr, dayStr)) {
          habitsCompleted += 1
        }
        return
      }

      if (dayStr < dueWindow.dueDateKey) {
        if (hasCompletionBetween(habitCompletionDateMap, habit.id, dueWindow.periodStartKey, dayStr)) {
          earlyCompletedHabits += 1
        }
        return
      }

      if (dayStr === dueWindow.dueDateKey) {
        dueHabits += 1
        if (hasCompletionBetween(habitCompletionDateMap, habit.id, dueWindow.periodStartKey, dueWindow.dueDateKey)) {
          habitsCompleted += 1
        }
      }
    })
    
    // Productivity for the day (real data only)
    const taskCompletion = dayPlannedWeight > 0
      ? (earnedTaskWeight / dayPlannedWeight) * 100
      : 0
    const habitCompletion = dueHabits > 0
      ? (habitsCompleted / dueHabits) * 100
      : 0
    const productivity = calculateWeightedProductivity(taskCompletion, habitCompletion, dueHabits > 0)
    
    return {
      date: displayDate,
      fullDate: dayStr,
      tasks: dayTasks.length,
      completed: completedTasks.length,
      partiallyCompleted: partialTasks.length,
      skipped: skippedTasks.length,
      weightedCompleted: earnedTaskWeight,
      habits: dueHabits,
      habitsCompleted,
      earlyCompletedHabits,
      productivity
    }
  })
}

// ============================================
// DASHBOARD SUMMARY (Single Source of Truth)
// ============================================

export interface TimeBlock {
  id: string
  start_time: string
  end_time?: string
  duration: number // in minutes
  task_id?: string
  created_at: string
}

export interface DashboardSummary {
  // OVERALL PROGRESS (time-scoped, weight-based planned vs earned)
  overallProgressToday: number // percentage (earned/planned)
  overallProgressWeek: number // percentage (earned/planned)
  overallProgressMonth: number // percentage (earned/planned)
  
  // TODAY FOCUS CARD
  tasksToday: number // total tasks due today
  tasksCompletedToday: number // completed tasks (binary)
  habitsToday: number // total habits scheduled today
  habitsCompletedToday: number // completed habits (binary)
  
  // TASK PROGRESS (binary completion counts + weighted metrics)
  taskCompletionRateToday: number // completed / total (percentage)
  weightedTaskProgressToday: number // earned_weight / planned_weight
  taskCompletionRateWeek: number // completed / total (percentage)
  weightedTaskProgressWeek: number
  
  // HABIT CONSISTENCY (separate from tasks)
  habitConsistencyToday: number // completed / expected (percentage)
  habitConsistencyWeek: number // average consistency
  
  // MONTH HEALTH CARD
  plannedWeightMonth: number // total weight of all tasks in month
  completedWeightMonth: number // earned weight of tasks in month
  daysRemainingInMonth: number
  
  // AT-RISK ITEMS CARD
  overdueTasks: number // count of overdue incomplete tasks
  slippedHabits: number // count of habits with low consistency
  
  // GOAL ACTIVITY SUMMARY CARD
  activeGoals: number // goals with status = 'active'
  goalsWithActivityThisPeriod: number // goals with completed linked tasks/habits
  
  // STREAKS & TRENDS (informational only - TASKS ONLY)
  currentTaskStreak: number // consecutive days with ≥1 completed task
  longestTaskStreak: number // historical maximum streak
  trendIndicator: 'improving' | 'stable' | 'declining' // task completion % this week vs last week
  
  // For display
  todaysTasks: Task[]
  todaysHabits: Habit[]
}

export const calculateDashboardSummary = (
  tasks: Task[],
  habits: Habit[],
  goals: Goal[],
  habitCompletions?: HabitCompletion[]
): DashboardSummary => {
  const today = getDateRange('day')
  const week = getDateRange('week')
  const month = getDateRange('month')
  const dayOfWeek = format(new Date(), 'EEEE').toLowerCase()
  const now = new Date()
  
  // Create a set of completed habit IDs for today from actual completion data
  const completedHabitIdsToday = new Set(
    (habitCompletions || [])
      .filter(hc => hc.completed && hc.date === getLocalDateString(new Date()))
      .map(hc => hc.habit_id)
  )
  
  // ============================================
  // HELPER: Planned vs earned weight in a date range (partial credit allowed)
  // ============================================
  const getPlannedEarnedWeightInRange = (tasksToCheck: Task[], dateRange: DateRange): { planned: number; earned: number } => {
    return tasksToCheck
      .filter(t => {
        if (t.deleted_at || isTaskPausedOnDate(t, dateRange.end)) return false
        // Count if task was due, created, or completed within range
        return isInRange(t.due_date, dateRange) || isInRange(t.completed_at, dateRange) || isInRange(t.created_at, dateRange)
      })
      .reduce((acc, t) => {
        const weight = PRIORITY_WEIGHTS[t.priority] || 1
        acc.planned += weight
        acc.earned += weight * getCompletionFactor(t.progress)
        return acc
      }, { planned: 0, earned: 0 })
  }
  
  // ============================================
  // TODAY FOCUS CARD
  // ============================================
  const tasksTodayList = tasks.filter(t => 
    !t.deleted_at && !isTaskPausedOnDate(t, new Date()) && t.due_date && isInRange(t.due_date, today)
  )
  const tasksToday = tasksTodayList.length
  
  const tasksCompletedToday = tasksTodayList.filter(t => (t.progress || 0) === 100).length
  
  const habitsToday = habits.filter(h => {
    if (h.deleted_at) return false
    if (h.frequency === 'daily') return true
    if (h.frequency === 'weekly' && h.schedule) {
      const schedule = typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
      return Array.isArray(schedule) && schedule.some(s => s.toLowerCase() === dayOfWeek)
    }
    return false
  }).length
  
  const habitsCompletedToday = habits.filter(h => {
    if (h.deleted_at || habitsToday === 0) return false
    if (h.frequency === 'daily' || (h.frequency === 'weekly' && h.schedule)) {
      const schedule = typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
      const isScheduledToday = h.frequency === 'daily' || 
        (Array.isArray(schedule) && schedule.some(s => s.toLowerCase() === dayOfWeek))
      
      // Use actual habit completion data from database instead of flag
      if (isScheduledToday && completedHabitIdsToday.has(h.id)) {
        return true
      }
    }
    return false
  }).length
  
  // ============================================
  // TASK PROGRESS (BINARY COMPLETION ONLY)
  // ============================================
  const todayTasksForAnalysis = tasksTodayList
  
  const taskCompletionRateToday = todayTasksForAnalysis.length > 0
    ? Math.round((tasksCompletedToday / todayTasksForAnalysis.length) * 100)
    : 0
  
  const { planned: totalWeightToday, earned: completedWeightToday } = getPlannedEarnedWeightInRange(tasks, today)
  const weightedTaskProgressToday = totalWeightToday > 0
    ? Math.round((completedWeightToday / totalWeightToday) * 100)
    : 0
  
  // Week stats
  const weekTasksForAnalysis = tasks.filter(t => 
    !t.deleted_at && !isTaskPausedOnDate(t, week.end) && (isInRange(t.due_date, week) || isInRange(t.completed_at, week))
  )
  const tasksCompletedWeek = weekTasksForAnalysis.filter(t => (t.progress || 0) === 100).length
  const taskCompletionRateWeek = weekTasksForAnalysis.length > 0
    ? Math.round((tasksCompletedWeek / weekTasksForAnalysis.length) * 100)
    : 0
  
  const { planned: totalWeightWeek, earned: completedWeightWeek } = getPlannedEarnedWeightInRange(tasks, week)
  const weightedTaskProgressWeek = totalWeightWeek > 0
    ? Math.round((completedWeightWeek / totalWeightWeek) * 100)
    : 0
  
  // ============================================
  // HABIT CONSISTENCY (SEPARATE FROM TASKS)
  // ============================================
  const habitConsistencyToday = habitsToday > 0
    ? Math.round((habitsCompletedToday / habitsToday) * 100)
    : 0
  
  // Week consistency - average of all habits' consistency scores
  const habitConsistencyWeek = habits.filter(h => !h.deleted_at).length > 0
    ? Math.round(
        habits
          .filter(h => !h.deleted_at)
          .reduce((sum, h) => sum + (h.consistency_score || 0), 0) / 
        habits.filter(h => !h.deleted_at).length
      )
    : 0
  
  // ============================================
  // OVERALL PROGRESS (COMPLETED WEIGHT ONLY, TIME-SCOPED)
  // ============================================
  const overallProgressToday = weightedTaskProgressToday
  const overallProgressWeek = weightedTaskProgressWeek
  
  const { planned: totalWeightMonth, earned: completedWeightMonth } = getPlannedEarnedWeightInRange(tasks, month)
  const overallProgressMonth = totalWeightMonth > 0
    ? Math.round((completedWeightMonth / totalWeightMonth) * 100)
    : 0
  
  // ============================================
  // MONTH HEALTH CARD
  // ============================================
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemainingInMonth = Math.max(0, daysInMonth - now.getDate())
  
  // ============================================
  // AT-RISK ITEMS CARD
  // ============================================
  const overdueTasks = tasks.filter(t => {
    if (t.deleted_at || (t.progress || 0) === 100) return false
    if ((t.progress || 0) > 0) return false
    if (!t.due_date) return false
    try {
      return parseISO(t.due_date) < startOfDay(now)
    } catch {
      return false
    }
  }).length
  
  const slippedHabits = habits.filter(h => 
    !h.deleted_at && (h.consistency_score || 0) < 50
  ).length
  
  // ============================================
  // GOAL ACTIVITY SUMMARY CARD
  // ============================================
  const activeGoals = goals.filter(g => !g.deleted_at && g.status === 'active').length
  
  // Goals with activity in the current period (completed linked tasks or habits)
  const goalsWithActivityThisPeriod = goals.filter(g => {
    if (g.deleted_at || g.status !== 'active') return false
    
    // Check for completed linked tasks in this week
    const linkedTasksThisWeek = tasks.filter(t => 
      !t.deleted_at && 
      t.goal_id === g.id && 
      (t.progress || 0) === 100 && 
      isInRange(t.completed_at, week)
    ).length
    
    // Check for completed linked habits
    const linkedHabitsWithActivity = habits.filter(h => 
      !h.deleted_at && 
      h.goal_id === g.id && 
      (h.consistency_score || 0) > 0
    ).length
    
    return linkedTasksThisWeek > 0 || linkedHabitsWithActivity > 0
  }).length
  
  // ============================================
  // STREAKS & TRENDS (INFORMATIONAL ONLY - TASKS ONLY)
  // ============================================
  
  // Current task streak: consecutive days with ≥1 task completed (100% only)
  let currentTaskStreak = 0
  const taskCompletedDates = new Set<string>()
  
  // Collect dates with completed tasks (100% only, no partial progress)
  tasks
    .filter(t => !t.deleted_at && (t.progress || 0) === 100 && t.completed_at)
    .forEach(t => {
      try {
        taskCompletedDates.add(format(parseISO(t.completed_at!), 'yyyy-MM-dd'))
      } catch {}
    })
  
  // Count consecutive days from today backwards
  let streakCursor = startOfDay(now)
  const streakTodayStr = format(streakCursor, 'yyyy-MM-dd')
  
  // If at least one task completed today, streak is active
  if (taskCompletedDates.has(streakTodayStr)) {
    currentTaskStreak = 1
    streakCursor = subDays(streakCursor, 1)
    
    for (let i = 0; i < 365; i++) {
      const dateStr = format(streakCursor, 'yyyy-MM-dd')
      if (taskCompletedDates.has(dateStr)) {
        currentTaskStreak++
        streakCursor = subDays(streakCursor, 1)
      } else {
        break
      }
    }
  }
  
  // Longest task streak: maximum historical consecutive days with ≥1 completed task
  let longestTaskStreak = currentTaskStreak
  let tempStreak = 0
  const sortedTaskDates = Array.from(taskCompletedDates).sort()
  
  for (const dateStr of sortedTaskDates) {
    const date = parseISO(dateStr)
    const prevDate = subDays(date, 1)
    const prevDateStr = format(prevDate, 'yyyy-MM-dd')
    
    if (tempStreak === 0 || taskCompletedDates.has(prevDateStr)) {
      tempStreak++
    } else {
      longestTaskStreak = Math.max(longestTaskStreak, tempStreak)
      tempStreak = 1
    }
  }
  longestTaskStreak = Math.max(longestTaskStreak, tempStreak)
  
  // Weekly trend: Compare task completion percentage this week vs last week
  // Formula: (Completed Tasks Count this week) / (Total Tasks Count this week) %
  //          vs (Completed Tasks Count last week) / (Total Tasks Count last week) %
  const lastWeekRange = {
    start: subDays(week.start, 7),
    end: subDays(week.end, 7)
  }
  
  // Count completed tasks this week (100% only, no weights)
  const thisWeekCompletedCount = tasks.filter(t =>
    !t.deleted_at && 
    (t.progress || 0) === 100 && 
    t.completed_at &&
    isInRange(t.completed_at, week)
  ).length
  
  // Count total tasks this week (due or completed)
  const thisWeekTotalCount = tasks.filter(t =>
    !t.deleted_at && 
    (isInRange(t.due_date, week) || isInRange(t.completed_at, week))
  ).length
  
  const thisWeekProgress = thisWeekTotalCount > 0 
    ? (thisWeekCompletedCount / thisWeekTotalCount) * 100 
    : 0
  
  // Count completed tasks last week (100% only)
  const lastWeekCompletedCount = tasks.filter(t =>
    !t.deleted_at && 
    (t.progress || 0) === 100 && 
    t.completed_at &&
    isInRange(t.completed_at, lastWeekRange)
  ).length
  
  // Count total tasks last week (due or completed)
  const lastWeekTotalCount = tasks.filter(t =>
    !t.deleted_at && 
    (isInRange(t.due_date, lastWeekRange) || isInRange(t.completed_at, lastWeekRange))
  ).length
  
  const lastWeekProgress = lastWeekTotalCount > 0 
    ? (lastWeekCompletedCount / lastWeekTotalCount) * 100 
    : 0
  
  // Determine trend (with 5% threshold to avoid noise)
  const progressChange = thisWeekProgress - lastWeekProgress
  let trendIndicator: 'improving' | 'stable' | 'declining' = 'stable'
  
  if (progressChange > 5) {
    trendIndicator = 'improving'
  } else if (progressChange < -5) {
    trendIndicator = 'declining'
  }
  
  // ============================================
  // TODAY'S ITEMS FOR DISPLAY
  // ============================================
  const todaysTasks = tasks
    .filter(t => !t.deleted_at && t.due_date && isInRange(t.due_date, today))
    .sort((a, b) => {
      // Incomplete first, then by priority
      const aComplete = (a.progress || 0) === 100
      const bComplete = (b.progress || 0) === 100
      if (aComplete && !bComplete) return 1
      if (!aComplete && bComplete) return -1
      
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
    })
    .slice(0, 10)
  
  const todaysHabits = habits.filter(h => {
    if (h.deleted_at) return false
    if (h.frequency === 'daily') return true
    if (h.frequency === 'weekly' && h.schedule) {
      const schedule = typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
      return Array.isArray(schedule) && schedule.some(s => s.toLowerCase() === dayOfWeek)
    }
    return false
  })
  
  return {
    // Overall progress (time-scoped, completed weight only)
    overallProgressToday,
    overallProgressWeek,
    overallProgressMonth,
    
    // Today focus
    tasksToday,
    tasksCompletedToday,
    habitsToday,
    habitsCompletedToday,
    
    // Task progress (binary)
    taskCompletionRateToday,
    weightedTaskProgressToday,
    taskCompletionRateWeek,
    weightedTaskProgressWeek,
    
    // Habit consistency (separate)
    habitConsistencyToday,
    habitConsistencyWeek,
    
    // Month health
    plannedWeightMonth: totalWeightMonth,
    completedWeightMonth,
    daysRemainingInMonth,
    
    // At-risk items
    overdueTasks,
    slippedHabits,
    
    // Goal activity
    activeGoals,
    goalsWithActivityThisPeriod,
    
    // Streaks & trends (tasks only)
    currentTaskStreak,
    longestTaskStreak,
    trendIndicator,
    
    // Display items
    todaysTasks,
    todaysHabits
  }
}

// ============================================
// EXPORTS FOR EASY IMPORT
// ============================================

export const ProgressUtils = {
  // Constants
  PRIORITY_WEIGHTS,
  HABIT_WEIGHT,
  
  // Date helpers
  getDateRange,
  getDateRangeDisplay,
  isInRange,
  
  // Habit display and reset logic
  shouldHabitDisplayInTodaysProgress,
  getWeekStartDate,
  getWeekEndDate,
  shouldWeeklyHabitResetToday,
  shouldMonthlyHabitResetToday,
  
  // Analytics
  calculateTaskAnalytics,
  calculateHabitAnalytics,
  calculateGoalProgress,
  calculateGoalAnalytics,
  calculateTimeAnalytics,
  calculateProductivityScore,
  calculateHabitDueMetricsForDay,
  calculateHabitDueSeries,
  calculateTrendData,
  calculateDashboardSummary
}

export default ProgressUtils
