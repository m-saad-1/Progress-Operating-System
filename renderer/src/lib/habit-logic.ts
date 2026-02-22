/**
 * HABIT WEEKLY/MONTHLY LOGIC
 * ==========================
 * Centralized business logic for weekly and monthly habits.
 * Single source of truth for:
 * - When habits should display in Today's Progress
 * - When habits should reset
 * - Habit completion validation and persistence
 */

import { Habit, HabitCompletion } from '@/types';
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';

/**
 * Week boundaries (Monday to Sunday)
 * Used by both weekly habit display and reset logic
 */
export const getWeekStart = (date: Date = new Date()): Date => {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday = 1
};

export const getWeekEnd = (date: Date = new Date()): Date => {
  return endOfWeek(date, { weekStartsOn: 1 }); // Sunday end
};

export const getMonthStart = (date: Date = new Date()): Date => {
  return startOfMonth(date);
};

export const getMonthEnd = (date: Date = new Date()): Date => {
  return endOfMonth(date);
};

/**
 * HABIT DISPLAY LOGIC
 * ===================
 * Determines if a habit should appear in Today's Progress
 * 
 * CRITICAL RULES:
 * - Daily habits: ALWAYS show (fresh each day)
 * - Weekly habits: ALWAYS show UNTIL next Monday (show completed status once done)
 * - Monthly habits: ALWAYS show UNTIL next month (show completed status once done)
 * 
 * This is the SINGLE SOURCE OF TRUTH for Today's Progress display.
 * Every component must use this function - NO EXCEPTIONS.
 */
export const shouldDisplayInTodaysProgress = (
  habit: Habit,
  allCompletions: HabitCompletion[]
): boolean => {
  // Safety checks
  if (!habit || habit.deleted_at) return false;
  if (!Array.isArray(allCompletions)) return false;

  const today = new Date();

  // ==========================================
  // DAILY HABITS - Always show
  // ==========================================
  if (habit.frequency === 'daily') {
    return true;
  }

  // ==========================================
  // WEEKLY HABITS - Only show on Sunday
  // ==========================================
  if (habit.frequency === 'weekly') {
    return today.getDay() === 0; // 0 is Sunday
  }

  // ==========================================
  // MONTHLY HABITS - Always show (with completion status)
  // ==========================================
  if (habit.frequency === 'monthly') {
    // Monthly habits show every day of the month
    return true;
  }

  return false;
};

/**
 * HABIT COMPLETION STATUS LOGIC
 * =============================
 * Determines the completion state of habits for Today's Progress display
 */

/**
 * Check if today is a scheduled day for a weekly habit
 */
export const isWeeklyHabitScheduledToday = (habit: Habit): boolean => {
  if (habit.frequency !== 'weekly') return false;

  const today = new Date();
  const schedule = typeof habit.schedule === 'string'
    ? JSON.parse(habit.schedule)
    : habit.schedule || [];

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayDayName = dayNames[today.getDay()];

  return Array.isArray(schedule) && 
    schedule.some(d => d.toLowerCase() === todayDayName.toLowerCase());
};

/**
 * Check if a weekly habit is completed THIS WEEK
 * Returns true if the habit has been marked complete any day this week
 */
export const isWeeklyHabitCompletedThisWeekPersistent = (
  habitId: string,
  completions: HabitCompletion[]
): boolean => {
  const today = new Date();
  const weekStart = startOfDay(getWeekStart(today));
  const weekEnd = endOfDay(today);

  return completions.some(c =>
    c.habit_id === habitId &&
    c.completed &&
    isWithinInterval(parseISO(c.date), { start: weekStart, end: weekEnd })
  );
};

/**
 * Check if a monthly habit is completed THIS MONTH
 * Returns true if the habit has been marked complete any day this month
 */
export const isMonthlyHabitCompletedThisMonthPersistent = (
  habitId: string,
  completions: HabitCompletion[]
): boolean => {
  const today = new Date();
  const monthStart = startOfDay(getMonthStart(today));
  const monthEnd = endOfDay(today);

  return completions.some(c =>
    c.habit_id === habitId &&
    c.completed &&
    isWithinInterval(parseISO(c.date), { start: monthStart, end: monthEnd })
  );
};

/**
 * Get the completion status of a habit for Today's Progress
 * Returns: 'completed-today', 'completed-period', or 'pending'
 */
export const getHabitCompletionStatus = (
  habit: Habit,
  allCompletions: HabitCompletion[]
): 'completed-today' | 'completed-period' | 'pending' => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  // Check if completed today
  const completedToday = allCompletions.some(c =>
    c.habit_id === habit.id &&
    c.completed &&
    c.date === todayStr
  );

  if (completedToday) {
    return 'completed-today';
  }

  // Check if completed in this week/month
  if (habit.frequency === 'weekly') {
    const completedThisWeek = isWeeklyHabitCompletedThisWeekPersistent(habit.id, allCompletions);
    if (completedThisWeek) {
      return 'completed-period';
    }
  } else if (habit.frequency === 'monthly') {
    const completedThisMonth = isMonthlyHabitCompletedThisMonthPersistent(habit.id, allCompletions);
    if (completedThisMonth) {
      return 'completed-period';
    }
  }

  return 'pending';
};

/**
 * HABIT RESET LOGIC
 * =================
 * Determines when habits should reset their completion state
 * 
 * RESET RULES:
 * - Daily habits: NO explicit reset (managed daily via new HabitCompletion entries)
 * - Weekly habits: Reset every Monday at 12:00 AM (start of new week)
 * - Monthly habits: Reset on 1st of each month at 12:00 AM
 */
export const shouldResetDailyHabits = (): boolean => {
  // Daily habits don't have a collective reset Time.
  // They are managed via daily HabitCompletion entries.
  // Each day, new entries are available for daily habits.
  return false;
};

export const shouldResetWeeklyHabits = (date: Date = new Date()): boolean => {
  // Reset on Monday (start of new week)
  const dayOfWeek = format(date, 'EEEE').toLowerCase();
  return dayOfWeek === 'monday';
};

export const shouldResetMonthlyHabits = (date: Date = new Date()): boolean => {
  // Reset on 1st of each month
  return date.getDate() === 1;
};

/**
 * FORM VALIDATION
 * ===============
 * Validates habit form data before saving
 */
export interface HabitFormValidation {
  isValid: boolean;
  errors: {
    title?: string;
    schedule?: string;
    [key: string]: string | undefined;
  };
}

export const validateHabitForm = (formData: {
  title?: string;
  frequency?: string;
  schedule?: string[];
}): HabitFormValidation => {
  const errors: { [key: string]: string } = {};

  // Validate title
  if (!formData.title || !formData.title.trim()) {
    errors.title = 'Habit title is required';
  }

  // For monthly habits, we might validate schedule if it contains specific dates
  // This depends on how monthly habits store their schedule

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * HABIT COMPLETION HISTORY
 * ========================
 * Utility functions for working with completion history
 */

export interface CompletionStats {
  completedDays: number;
  totalExpectedDays: number;
  completionPercentage: number;
  lastCompletedDate: string | null;
}

/**
 * Calculate completion stats for a habit within a date range
 */
export const calculateCompletionStats = (
  habit: Habit,
  completions: HabitCompletion[],
  startDate: Date,
  endDate: Date
): CompletionStats => {
  const habitCompletions = completions.filter(
    c => c.habit_id === habit.id && c.completed
  );

  const daysInRange = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return {
    completedDays: habitCompletions.length,
    totalExpectedDays: daysInRange,
    completionPercentage: daysInRange > 0 
      ? Math.round((habitCompletions.length / daysInRange) * 100)
      : 0,
    lastCompletedDate: habitCompletions.length > 0
      ? getLastCompletedDate(habitCompletions)
      : null,
  };
};

/**
 * Get the most recent completion date
 */
export const getLastCompletedDate = (completions: HabitCompletion[]): string | null => {
  const sorted = [...completions]
    .filter(c => c.completed)
    .sort((a, b) => b.date.localeCompare(a.date));
  return sorted.length > 0 ? sorted[0].date : null;
};

/**
 * Check if a habit was completed on a specific date
 */
export const isCompletedOnDate = (
  habitId: string,
  date: string,
  completions: HabitCompletion[]
): boolean => {
  return completions.some(
    c => c.habit_id === habitId && c.date === date && c.completed
  );
};

/**
 * WEEKLY HABIT HELPERS
 * ====================
 */

/**
 * Check if a habit is scheduled for a specific day of week
 */
export const isScheduledForDay = (habit: Habit, dayOfWeek: string): boolean => {
  if (habit.frequency !== 'weekly') return false;
  
  const schedule = typeof habit.schedule === 'string'
    ? JSON.parse(habit.schedule)
    : habit.schedule || [];

  return Array.isArray(schedule) && 
    schedule.some(d => d.toLowerCase() === dayOfWeek.toLowerCase());
};

/**
 * Get all days a weekly habit is scheduled for
 */
export const getScheduledDays = (habit: Habit): string[] => {
  if (habit.frequency !== 'weekly') return [];
  
  const schedule = typeof habit.schedule === 'string'
    ? JSON.parse(habit.schedule)
    : habit.schedule || [];

  return Array.isArray(schedule) ? schedule : [];
};

/**
 * Check if a weekly habit was completed at any point during its scheduled days this week
 */
export const isWeeklyHabitCompletedThisWeek = (
  habitId: string,
  completions: HabitCompletion[]
): boolean => {
  const today = new Date();
  const weekStart = startOfDay(getWeekStart(today));
  const weekEnd = endOfDay(today);

  return completions.some(c =>
    c.habit_id === habitId &&
    c.completed &&
    isWithinInterval(parseISO(c.date), { start: weekStart, end: weekEnd })
  );
};

/**
 * MONTHLY HABIT HELPERS
 * =====================
 */

/**
 * Check if a monthly habit was completed at any point during this month
 */
export const isMonthlyHabitCompletedThisMonth = (
  habitId: string,
  completions: HabitCompletion[]
): boolean => {
  const today = new Date();
  const monthStart = startOfDay(getMonthStart(today));
  const monthEnd = endOfDay(today);

  return completions.some(c =>
    c.habit_id === habitId &&
    c.completed &&
    isWithinInterval(parseISO(c.date), { start: monthStart, end: monthEnd })
  );
};

/**
 * EXPORTS
 * =======
 */
export const HabitLogicUtils = {
  // Display logic
  shouldDisplayInTodaysProgress,

  // Completion status
  isWeeklyHabitScheduledToday,
  isWeeklyHabitCompletedThisWeekPersistent,
  isMonthlyHabitCompletedThisMonthPersistent,
  getHabitCompletionStatus,

  // Reset logic
  shouldResetDailyHabits,
  shouldResetWeeklyHabits,
  shouldResetMonthlyHabits,

  // Form validation
  validateHabitForm,

  // Completion stats
  calculateCompletionStats,
  getLastCompletedDate,
  isCompletedOnDate,

  // Weekly helpers
  isScheduledForDay,
  getScheduledDays,
  isWeeklyHabitCompletedThisWeek,

  // Monthly helpers
  isMonthlyHabitCompletedThisMonth,

  // Date boundaries
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
};

export default HabitLogicUtils;
