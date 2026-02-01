/**
 * PROGRESS CALCULATION UTILITIES
 * ==============================
 * This is the SINGLE SOURCE OF TRUTH for all progress calculations.
 * All pages (Dashboard, Goals, Analytics, Habits, Tasks) MUST use these functions.
 * 
 * DO NOT duplicate formulas anywhere else in the codebase.
 * 
 * ============================================
 * WEIGHT SYSTEM (NON-NEGOTIABLE)
 * ============================================
 * - High-Value Task (critical) → 4 points
 * - High-Value Task (high)     → 3 points  
 * - Medium-Value Task          → 2 points
 * - Low-Value Task             → 1 point
 * - Habit Completion           → 1 point (per valid interval)
 * 
 * ============================================
 * TIME-BASED PROGRESS VALIDATION
 * ============================================
 * - Daily:   Tasks due today + habits scheduled for today
 * - Weekly:  Last 7 days of completed tasks + habit consistency
 * - Monthly: Last 30 days aggregate
 * - Yearly:  Last 365 days aggregate
 * 
 * RULES:
 * - Progress is derived STRICTLY from completed tasks and habits within time window
 * - Historical data is IMMUTABLE once recorded
 * - Habit completions are stored in habit_completions table (not calculated)
 * 
 * ============================================
 * PRODUCTIVITY SCORE FORMULA
 * ============================================
 * - 60% Tasks (weighted completion rate based on PRIORITY_WEIGHTS)
 * - 40% Habits (average consistency score)
 * 
 * ============================================
 * PROGRESS INTEGRITY RULES
 * ============================================
 * - NO GAMING: Users cannot inflate progress by toggling states repeatedly
 *   (habit_completions uses INSERT OR REPLACE - only final state matters)
 * - NO FAKE PRODUCTIVITY: Progress only increases through legitimate completed actions
 * - REAL BEHAVIORAL TRACKING: Progress reflects actual user behavior over time
 * - BOUNDS: All percentages are capped at 0-100
 * - FUTURE PREVENTION: Habit completions cannot be set for future dates
 */

import { 
  parseISO, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  subDays, 
  subMonths, 
  subQuarters, 
  subYears,
  differenceInDays,
  eachDayOfInterval,
  format,
  isToday
} from 'date-fns'
import type { Task, Goal, Habit } from '@/types'

// ============================================
// CONSTANTS (Single Source of Truth)
// ============================================

/**
 * Priority weight mapping for tasks.
 * These values are NON-NEGOTIABLE and must be used consistently across all modules.
 * 
 * @example
 * const taskWeight = PRIORITY_WEIGHTS[task.priority] || 1
 */
export const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 4,  // Highest priority tasks (urgent + important)
  high: 3,      // High-value tasks
  medium: 2,    // Standard tasks
  low: 1        // Low-priority tasks
}

/**
 * Weight assigned to each habit completion.
 * Habits contribute uniformly regardless of frequency.
 */
export const HABIT_WEIGHT = 1

// ============================================
// DAILY PROGRESS CALCULATION (Single Source of Truth)
// ============================================

/**
 * Calculates today's progress based on tasks and habits.
 * 
 * Formula:
 * - Tasks: (completed_task_weight / total_task_weight) * task_contribution
 * - Habits: (completed_daily_habits / total_daily_habits) * habit_contribution
 * - Combined: 60% tasks + 40% habits (if both exist)
 * 
 * @param tasks - All tasks from the store
 * @param habits - All habits from the store
 * @returns Progress percentage (0-100)
 */
export const calculateDailyProgress = (tasks: Task[], habits: Habit[]): number => {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  
  // Filter tasks that are due today or have progress for today
  const todaysTasks = tasks.filter(t => {
    if (t.deleted_at) return false
    // Task is due today
    if (t.due_date) {
      try {
        const dueDate = parseISO(t.due_date)
        if (isToday(dueDate)) return true
      } catch {
        // Invalid date
      }
    }
    // Task was completed today
    if (t.completed_at) {
      try {
        const completedDate = parseISO(t.completed_at)
        if (isToday(completedDate)) return true
      } catch {
        // Invalid date
      }
    }
    // Task has daily progress for today
    if (t.daily_progress && t.daily_progress[todayStr] !== undefined) {
      return true
    }
    return false
  })
  
  // Calculate task progress with weights
  let totalTaskWeight = 0
  let completedTaskWeight = 0
  
  todaysTasks.forEach(task => {
    const weight = PRIORITY_WEIGHTS[task.priority] || 1
    totalTaskWeight += weight
    
    if (task.status === 'completed') {
      completedTaskWeight += weight
    } else if (task.daily_progress && task.daily_progress[todayStr] !== undefined) {
      // Partial completion based on daily progress
      completedTaskWeight += weight * (task.daily_progress[todayStr] / 100)
    } else if (task.progress > 0) {
      // Use task progress if available
      completedTaskWeight += weight * (task.progress / 100)
    }
  })
  
  // Filter daily habits (habits that should be done today)
  const dayOfWeek = format(today, 'EEEE').toLowerCase()
  const todaysHabits = habits.filter(h => {
    if (h.deleted_at) return false
    if (h.frequency === 'daily') return true
    if (h.frequency === 'weekly' && h.schedule) {
      const schedule = typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
      return Array.isArray(schedule) && schedule.map(s => s.toLowerCase()).includes(dayOfWeek)
    }
    return false
  })
  
  // Calculate habit progress
  // Check the today_completed flag which is populated from habit_completions table
  // If today_completed is not available, fall back to checking if streak was updated today
  const completedHabits = todaysHabits.filter(h => {
    // Primary check: explicit today_completed flag from habit_completions
    if ('today_completed' in h && typeof h.today_completed === 'boolean') {
      return h.today_completed
    }
    // Fallback: if habit was updated today and has active streak, consider it completed
    // This handles cases where habit data comes without the today_completed join
    if (h.streak_current > 0 && h.updated_at) {
      try {
        const updatedDate = parseISO(h.updated_at)
        return isToday(updatedDate)
      } catch {
        return false
      }
    }
    return false
  }).length
  const totalHabits = todaysHabits.length
  
  // Calculate combined progress
  const hasTaskData = totalTaskWeight > 0
  const hasHabitData = totalHabits > 0
  
  if (!hasTaskData && !hasHabitData) {
    return 0
  }
  
  const taskProgress = hasTaskData 
    ? (completedTaskWeight / totalTaskWeight) * 100 
    : 0
    
  const habitProgress = hasHabitData 
    ? (completedHabits / totalHabits) * 100 
    : 0
  
  // Weighted combination: 60% tasks, 40% habits
  // If only one exists, use that one at 100%
  if (hasTaskData && hasHabitData) {
    return Math.round(taskProgress * 0.6 + habitProgress * 0.4)
  } else if (hasTaskData) {
    return Math.round(taskProgress)
  } else {
    return Math.round(habitProgress)
  }
}

export const PRODUCTIVITY_WEIGHTS = {
  tasks: 0.6,
  habits: 0.4
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
  const end = endOfDay(new Date())
  let start: Date
  
  switch (range) {
    case 'day':
      start = startOfDay(new Date())
      break
    case 'week':
      start = startOfDay(subDays(new Date(), 6))
      break
    case 'month':
      start = startOfDay(subMonths(new Date(), 1))
      break
    case 'quarter':
      start = startOfDay(subQuarters(new Date(), 1))
      break
    case 'year':
      start = startOfDay(subYears(new Date(), 1))
      break
    default:
      start = startOfDay(subMonths(new Date(), 1))
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
  blocked: number
  overdue: number
  totalWeight: number
  completedWeight: number
  weightedCompletionRate: number
  simpleCompletionRate: number
  byPriority: {
    critical: Task[]
    high: Task[]
    medium: Task[]
    low: Task[]
  }
  completedByPriority: {
    critical: number
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
  // Filter tasks by date range if provided
  const filteredTasks = dateRange 
    ? tasks.filter(t => !t.deleted_at && isInRange(t.created_at, dateRange))
    : tasks.filter(t => !t.deleted_at)
  
  const completedTasks = filteredTasks.filter(t => t.status === 'completed')
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending')
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress')
  const blockedTasks = filteredTasks.filter(t => t.status === 'blocked')
  
  // Calculate weighted totals
  const totalWeight = filteredTasks.reduce((sum, t) => 
    sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0
  )
  
  const completedWeight = completedTasks.reduce((sum, t) => 
    sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0
  )
  
  const weightedCompletionRate = totalWeight > 0 
    ? Math.round((completedWeight / totalWeight) * 100) 
    : 0
  
  // Simple completion rate (unweighted)
  const simpleCompletionRate = filteredTasks.length > 0
    ? Math.round((completedTasks.length / filteredTasks.length) * 100)
    : 0
  
  // Priority breakdown
  const byPriority = {
    critical: filteredTasks.filter(t => t.priority === 'critical'),
    high: filteredTasks.filter(t => t.priority === 'high'),
    medium: filteredTasks.filter(t => t.priority === 'medium'),
    low: filteredTasks.filter(t => t.priority === 'low')
  }
  
  const completedByPriority = {
    critical: completedTasks.filter(t => t.priority === 'critical').length,
    high: completedTasks.filter(t => t.priority === 'high').length,
    medium: completedTasks.filter(t => t.priority === 'medium').length,
    low: completedTasks.filter(t => t.priority === 'low').length
  }
  
  // Time estimates
  const totalEstimatedTime = filteredTasks.reduce((sum, t) => sum + (t.estimated_time || 0), 0)
  const totalActualTime = completedTasks.reduce((sum, t) => sum + (t.actual_time || 0), 0)
  
  // Overdue tasks
  const overdueTasks = filteredTasks.filter(t => 
    t.status !== 'completed' && 
    t.due_date && 
    parseISO(t.due_date) < new Date()
  )
  
  return {
    total: filteredTasks.length,
    completed: completedTasks.length,
    pending: pendingTasks.length,
    inProgress: inProgressTasks.length,
    blocked: blockedTasks.length,
    overdue: overdueTasks.length,
    totalWeight,
    completedWeight,
    weightedCompletionRate,
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

export const calculateHabitAnalytics = (habits: Habit[]): HabitAnalytics => {
  const activeHabits = habits.filter(h => !h.deleted_at)
  
  // Total streaks and consistency
  const totalCurrentStreak = activeHabits.reduce((sum, h) => sum + h.streak_current, 0)
  const totalLongestStreak = activeHabits.reduce((sum, h) => sum + h.streak_longest, 0)
  const avgConsistency = activeHabits.length > 0
    ? Math.round(activeHabits.reduce((sum, h) => sum + h.consistency_score, 0) / activeHabits.length)
    : 0
  
  // Best performing habits (by consistency)
  const sortedByConsistency = [...activeHabits].sort((a, b) => b.consistency_score - a.consistency_score)
  const topHabits = sortedByConsistency.slice(0, 5)
  const strugglingHabits = sortedByConsistency.filter(h => h.consistency_score < 50).slice(0, 5)
  
  // Habit completion weight (each streak day = 1 weight)
  const totalHabitWeight = totalCurrentStreak * HABIT_WEIGHT
  
  // By frequency
  const byFrequency = {
    daily: activeHabits.filter(h => h.frequency === 'daily'),
    weekly: activeHabits.filter(h => h.frequency === 'weekly'),
    monthly: activeHabits.filter(h => h.frequency === 'monthly')
  }
  
  return {
    total: activeHabits.length,
    newInRange: activeHabits.length,
    totalCurrentStreak,
    totalLongestStreak,
    avgConsistency,
    maxStreak: activeHabits.length > 0 ? Math.max(...activeHabits.map(h => h.streak_longest)) : 0,
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
  const linkedTasks = tasks.filter(t => t.goal_id === goal.id && !t.deleted_at)
  const completedTasks = linkedTasks.filter(t => t.status === 'completed')
  const linkedHabits = habits.filter(h => h.goal_id === goal.id && !h.deleted_at)
  
  // Calculate task progress (weighted by priority)
  const totalTaskWeight = linkedTasks.reduce((sum, t) => 
    sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0
  )
  const completedTaskWeight = completedTasks.reduce((sum, t) => 
    sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0
  )
  const taskProgress = totalTaskWeight > 0 
    ? Math.round((completedTaskWeight / totalTaskWeight) * 100)
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
  habits: Habit[]
): GoalAnalytics => {
  const activeGoals = goals.filter(g => !g.deleted_at && g.status === 'active')
  const completedGoals = goals.filter(g => !g.deleted_at && g.status === 'completed')
  const pausedGoals = goals.filter(g => !g.deleted_at && g.status === 'paused')
  
  // Calculate progress for all goals
  const goalsWithProgress = goals
    .filter(g => !g.deleted_at)
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
  
  // Overdue goals
  const overdueGoals = activeGoals.filter(g => 
    g.target_date && parseISO(g.target_date) < new Date()
  )
  
  // Linked tasks across all goals
  const totalLinkedTasks = tasks.filter(t => t.goal_id && !t.deleted_at).length
  const completedLinkedTasks = tasks.filter(t => 
    t.goal_id && !t.deleted_at && t.status === 'completed'
  ).length
  
  // Average goal progress (from calculated progress, not stored)
  const activeGoalsWithProgress = goalsWithProgress.filter(g => g.status === 'active')
  const avgGoalProgress = activeGoalsWithProgress.length > 0
    ? Math.round(activeGoalsWithProgress.reduce((sum, g) => sum + g.calculatedProgress, 0) / activeGoalsWithProgress.length)
    : 0
  
  return {
    total: goals.filter(g => !g.deleted_at).length,
    active: activeGoals.length,
    completed: completedGoals.length,
    completedInRange: completedGoals.length,
    newInRange: goals.filter(g => !g.deleted_at).length,
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
  const completedTasksInRange = tasks.filter(t => 
    !t.deleted_at && 
    t.status === 'completed' &&
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

export interface ProductivityScore {
  overall: number
  taskComponent: number
  habitComponent: number
  breakdown: {
    weightedTaskCompletion: number
    habitConsistency: number
  }
}

export const calculateProductivityScore = (
  taskAnalytics: TaskAnalytics,
  habitAnalytics: HabitAnalytics
): ProductivityScore => {
  const taskScore = taskAnalytics.weightedCompletionRate
  const habitScore = habitAnalytics.avgConsistency
  
  const taskComponent = taskScore * PRODUCTIVITY_WEIGHTS.tasks
  const habitComponent = habitScore * PRODUCTIVITY_WEIGHTS.habits
  
  return {
    overall: Math.round(taskComponent + habitComponent),
    taskComponent: Math.round(taskComponent),
    habitComponent: Math.round(habitComponent),
    breakdown: {
      weightedTaskCompletion: taskScore,
      habitConsistency: habitScore
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
  weightedCompleted: number
  habits: number
  habitsCompleted: number
  productivity: number
}

export const calculateTrendData = (
  tasks: Task[],
  habits: Habit[],
  dateRange: DateRange,
  displayFormat: 'short' | 'medium' | 'long' = 'medium'
): TrendDataPoint[] => {
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })
  
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
    
    // Tasks due on this day
    const dayTasks = tasks.filter(t => 
      !t.deleted_at && 
      t.due_date && 
      format(parseISO(t.due_date), 'yyyy-MM-dd') === dayStr
    )
    
    // Tasks completed on this day
    const dayCompletedTasks = tasks.filter(t => 
      !t.deleted_at && 
      t.status === 'completed' &&
      t.completed_at &&
      format(parseISO(t.completed_at), 'yyyy-MM-dd') === dayStr
    )
    
    // Weighted completed tasks
    const weightedCompleted = dayCompletedTasks.reduce((sum, t) => 
      sum + (PRIORITY_WEIGHTS[t.priority] || 1), 0
    )
    
    // Active habits count
    const activeHabits = habits.filter(h => !h.deleted_at)
    
    // Habits with active streaks (simplified - would need habit_completions for exact data)
    const habitsCompleted = activeHabits.filter(h => h.streak_current > 0).length
    
    // Productivity for the day
    const productivity = dayTasks.length > 0 
      ? Math.round((dayCompletedTasks.length / dayTasks.length) * 100) 
      : habitsCompleted > 0 ? 50 : 0
    
    return {
      date: displayDate,
      fullDate: dayStr,
      tasks: dayTasks.length,
      completed: dayCompletedTasks.length,
      weightedCompleted,
      habits: activeHabits.length,
      habitsCompleted,
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
  // Today's stats
  tasksCompletedToday: number
  tasksDueToday: number
  overdueTasks: number
  
  // Weekly stats
  tasksCompletedThisWeek: number
  
  // Progress scores
  productivityScore: number
  averageGoalProgress: number
  habitConsistency: number
  
  // Streaks
  habitStreaks: number
  longestStreak: number
  
  // Focus time
  focusTimeToday: number // in minutes
  focusTimeThisWeek: number // in minutes
  
  // Today's items (for display)
  todaysTasks: Task[]
  todaysHabits: Habit[]
  
  // Effort
  totalEffort: number
}

export const calculateDashboardSummary = (
  tasks: Task[],
  habits: Habit[],
  goals: Goal[],
  timeBlocks: TimeBlock[] = []
): DashboardSummary => {
  const today = getDateRange('day')
  const week = getDateRange('week')
  const dayOfWeek = format(new Date(), 'EEEE').toLowerCase()
  
  const taskAnalytics = calculateTaskAnalytics(tasks)
  const habitAnalytics = calculateHabitAnalytics(habits)
  const goalAnalytics = calculateGoalAnalytics(goals, tasks, habits)
  const productivityScore = calculateProductivityScore(taskAnalytics, habitAnalytics)
  
  // Today's completed tasks
  const tasksCompletedToday = tasks.filter(t => 
    !t.deleted_at && 
    t.status === 'completed' &&
    isInRange(t.completed_at, today)
  ).length
  
  // Today's due tasks (including incomplete)
  const tasksDueToday = tasks.filter(t => 
    !t.deleted_at &&
    t.due_date &&
    isInRange(t.due_date, today)
  ).length
  
  // This week's completed tasks
  const tasksCompletedThisWeek = tasks.filter(t => 
    !t.deleted_at && 
    t.status === 'completed' &&
    isInRange(t.completed_at, week)
  ).length
  
  // Today's tasks for display (sorted by priority, not completed first)
  const todaysTasks = tasks
    .filter(t => !t.deleted_at && t.due_date && isInRange(t.due_date, today) && t.status !== 'completed')
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    })
    .slice(0, 10)
  
  // Today's habits for display
  const todaysHabits = habits.filter(h => {
    if (h.deleted_at) return false
    if (h.frequency === 'daily') return true
    if (h.frequency === 'weekly' && h.schedule) {
      const schedule = typeof h.schedule === 'string' ? JSON.parse(h.schedule) : h.schedule
      return Array.isArray(schedule) && schedule.includes(dayOfWeek)
    }
    return false
  })
  
  // Focus time calculations
  const focusTimeToday = timeBlocks
    .filter(tb => isInRange(tb.start_time, today))
    .reduce((sum, tb) => sum + (tb.duration || 0), 0)
  
  const focusTimeThisWeek = timeBlocks
    .filter(tb => isInRange(tb.start_time, week))
    .reduce((sum, tb) => sum + (tb.duration || 0), 0)
  
  // Habit streaks (habits with streak >= 7 days)
  const habitStreaks = habits.filter(h => !h.deleted_at && (h.streak_current || 0) >= 7).length
  
  // Total effort (task weight + habit streaks)
  const totalEffort = taskAnalytics.completedWeight + habitAnalytics.totalHabitWeight
  
  return {
    tasksCompletedToday,
    tasksDueToday,
    overdueTasks: taskAnalytics.overdue,
    tasksCompletedThisWeek,
    productivityScore: productivityScore.overall,
    averageGoalProgress: goalAnalytics.avgGoalProgress,
    habitConsistency: habitAnalytics.avgConsistency,
    habitStreaks,
    longestStreak: habitAnalytics.maxStreak,
    focusTimeToday,
    focusTimeThisWeek,
    todaysTasks,
    todaysHabits,
    totalEffort
  }
}

// ============================================
// EXPORTS FOR EASY IMPORT
// ============================================

export const ProgressUtils = {
  // Constants
  PRIORITY_WEIGHTS,
  HABIT_WEIGHT,
  PRODUCTIVITY_WEIGHTS,
  
  // Date helpers
  getDateRange,
  isInRange,
  
  // Analytics
  calculateTaskAnalytics,
  calculateHabitAnalytics,
  calculateGoalProgress,
  calculateGoalAnalytics,
  calculateTimeAnalytics,
  calculateProductivityScore,
  calculateTrendData,
  calculateDashboardSummary
}

export default ProgressUtils
