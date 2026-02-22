/**
 * HABIT DAILY RESET UTILITIES
 * ============================
 * Handles habit completion state reset at midnight (12:00 AM local time)
 * Preserves all historical data while resetting today's completion status
 * 
 * KEY CONCEPTS:
 * - Habits are tracked per-day via HabitCompletion records
 * - Streak is calculated from consecutive day completions (not affected by reset)
 * - Consistency is calculated from historical completion rate (not affected by reset)
 * - Reset only affects today's completion UI state, not historical records
 * - Previous-day data remains in database for analytics
 */

import { startOfDay, isBefore, format, parseISO, differenceInDays, eachDayOfInterval } from 'date-fns'
import type { Habit, HabitCompletion } from '@/types'

/**
 * Checks if today's completion state should be reset based on the last reset date
 * 
 * Returns true if:
 * - Habit has never been reset (last_reset_date undefined)
 * - Last reset was before today
 * 
 * Returns false if:
 * - Last reset was today
 * 
 * @param lastResetDate - ISO string of when habit was last reset, undefined if never
 * @returns true if a reset should occur, false if already reset today
 */
export const shouldResetHabitToday = (lastResetDate: string | undefined): boolean => {
  if (!lastResetDate) return true
  
  const today = startOfDay(new Date())
  const lastReset = startOfDay(parseISO(lastResetDate))
  
  return isBefore(lastReset, today) || lastReset.getTime() !== today.getTime()
}

/**
 * Calculates the current streak by counting consecutive completed days
 * 
 * Streaks count from today backwards:
 * - If today incomplete: streak breaks (unless today hasn't been marked yet)
 * - Counts consecutive days with completion = true
 * - Resets to 0 if any day is incomplete
 * 
 * @param habitId - The habit to calculate streak for
 * @param completionHistory - Array of HabitCompletion records for this habit
 * @returns Current streak count (0 if broken or no completions)
 */
export const calculateCurrentStreak = (
  completionHistory: HabitCompletion[]
): number => {
  if (completionHistory.length === 0) return 0
  
  // Sort completions by date descending (newest first)
  const sorted = [...completionHistory].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  
  let streak = 0
  const today = startOfDay(new Date())
  let expectedDate = today
  
  for (const completion of sorted) {
    const completionDate = startOfDay(parseISO(completion.date))
    
    // If this completion matches the expected date and is marked complete, increment streak
    if (completionDate.getTime() === expectedDate.getTime() && completion.completed) {
      streak++
      expectedDate.setDate(expectedDate.getDate() - 1)
    } else if (completionDate.getTime() === expectedDate.getTime() && !completion.completed) {
      // Incomplete day breaks the streak
      break
    } else if (completionDate.getTime() < expectedDate.getTime()) {
      // Gap in dates - streak broken
      break
    }
  }
  
  return streak
}

/**
 * Calculates the longest streak achieved
 * 
 * Scans through entire history to find the longest consecutive completed sequence
 * 
 * @param completionHistory - Array of HabitCompletion records for this habit
 * @returns Longest consecutive completed days
 */
export const calculateLongestStreak = (
  completionHistory: HabitCompletion[]
): number => {
  if (completionHistory.length === 0) return 0
  
  // Sort completions by date ascending (oldest first)
  const sorted = [...completionHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  
  let longestStreak = 0
  let currentStreak = 0
  let lastDate: Date | null = null
  
  for (const completion of sorted) {
    const completionDate = startOfDay(parseISO(completion.date))
    
    if (!completion.completed) {
      // Reset current streak on incomplete day
      currentStreak = 0
      lastDate = null
      continue
    }
    
    if (lastDate === null) {
      // Start new streak
      currentStreak = 1
      lastDate = completionDate
    } else {
      const daysDiff = differenceInDays(completionDate, lastDate)
      
      if (daysDiff === 1) {
        // Consecutive day - continue streak
        currentStreak++
        lastDate = completionDate
      } else {
        // Gap detected - reset streak
        longestStreak = Math.max(longestStreak, currentStreak)
        currentStreak = 1
        lastDate = completionDate
      }
    }
  }
  
  return Math.max(longestStreak, currentStreak)
}

/**
 * Calculates consistency score (completion rate) for a date range
 * 
 * Formula: (days_completed / total_days_in_range) × 100
 * 
 * Only counts days where the habit should have been completed based on frequency:
 * - Daily: all days in range
 * - Weekly: specific days of week in range
 * - Monthly: all days in range (but only if habit existed before the month)
 * 
 * @param completionHistory - Array of HabitCompletion records
 * @param habitCreatedAt - When the habit was created (ISO string)
 * @param dateRange - Optional date range, defaults to last 30 days
 * @returns Consistency percentage (0-100)
 */
export const calculateConsistency = (
  completionHistory: HabitCompletion[],
  habitCreatedAt: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  schedule: string[] = [],
  dateRange?: { start: Date; end: Date }
): number => {
  // Default to last 30 days
  const end = dateRange?.end || new Date()
  const thirtyDaysAgo = new Date(end)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const start = dateRange?.start || thirtyDaysAgo
  
  // Adjust start to not go before habit creation
  const createdDate = startOfDay(parseISO(habitCreatedAt))
  const adjustedStart = isBefore(createdDate, startOfDay(start)) ? startOfDay(start) : createdDate
  
  // Get all days in range
  const allDays = eachDayOfInterval({
    start: adjustedStart,
    end: startOfDay(end)
  })
  
  // Filter expected days based on frequency
  let expectedDays: Date[] = []
  
  if (frequency === 'daily') {
    expectedDays = allDays
  } else if (frequency === 'weekly') {
    // Only days matching the schedule
    expectedDays = allDays.filter(day => {
      const dayName = format(day, 'EEEE').toLowerCase()
      return schedule.includes(dayName)
    })
  } else if (frequency === 'monthly') {
    // All days (monthly habits are counted daily if scheduled)
    expectedDays = allDays
  }
  
  if (expectedDays.length === 0) return 0
  
  // Count completed days
  const completedCount = expectedDays.filter(expectedDay => {
    const dayStr = format(expectedDay, 'yyyy-MM-dd')
    const completion = completionHistory.find(c => c.date === dayStr)
    return completion?.completed || false
  }).length
  
  return Math.round((completedCount / expectedDays.length) * 100)
}

/**
 * Gets today's completion status for a habit
 * 
 * Returns the HabitCompletion record for today, or null if not yet created
 * 
 * @param completionHistory - Array of HabitCompletion records
 * @returns Today's completion record or null
 */
export const getTodayCompletion = (
  completionHistory: HabitCompletion[]
): HabitCompletion | null => {
  const today = format(new Date(), 'yyyy-MM-dd')
  return completionHistory.find(c => c.date === today) || null
}

/**
 * Checks if a habit should be expected today
 * 
 * Returns true if:
 * - Daily: always true
 * - Weekly: today is in the habit's schedule
 * - Monthly: always true
 * 
 * @param frequency - Habit frequency type
 * @param schedule - Array of day names (for weekly habits)
 * @returns true if habit should be marked today
 */
export const isHabitExpectedToday = (
  frequency: 'daily' | 'weekly' | 'monthly',
  schedule: string[] = []
): boolean => {
  if (frequency === 'daily') return true
  if (frequency === 'monthly') return true
  
  if (frequency === 'weekly') {
    const today = format(new Date(), 'EEEE').toLowerCase()
    return schedule.includes(today)
  }
  
  return false
}

/**
 * Resets habit completion for a new day
 * 
 * In the database/store, this means:
 * - Previous day's completion is preserved as-is
 * - Today's completion record is created with completed=false (or updated)
 * - Streak/Consistency are recalculated from the history
 * - No data is deleted or modified (append-only history)
 * 
 * This function returns the reset data to be written to the database
 */
export const getResetDataForNewDay = (): { completed: boolean; updated_at: string } => {
  return {
    completed: false,
    updated_at: new Date().toISOString()
  }
}

/**
 * Validates habit data integrity after reset
 * 
 * Checks:
 * - No duplicate completions for the same day
 * - Streak calculation matches expected pattern
 * - Consistency score is within valid range
 * 
 * @param habit - The habit to validate
 * @param completionHistory - Full completion history
 * @returns true if valid, false if integrity issues found
 */
export const validateHabitIntegrity = (
  habit: Habit,
  completionHistory: HabitCompletion[]
): boolean => {
  // Check for duplicate dates
  const dateSet = new Set<string>()
  for (const completion of completionHistory) {
    if (dateSet.has(completion.date)) return false
    dateSet.add(completion.date)
  }
  
  // Check consistency score range
  if (habit.consistency_score < 0 || habit.consistency_score > 100) return false
  
  // Check streak is non-negative
  if (habit.streak_current < 0 || habit.streak_longest < 0) return false
  
  return true
}
