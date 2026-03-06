/**
 * ANALYTICS UTILITIES
 * ==================
 * Centralized functions for analytics calculations with proper
 * paused task filtering, offline handling, and error recovery.
 */

import { 
  startOfMonth, 
  endOfMonth, 
  startOfDay,
  format,
  parseISO,
  subMonths,
  addMonths
} from 'date-fns'

/**
 * Safely parse date strings with defensive error handling
 * Recovers gracefully from corrupted data after sleep/offline
 */
export const safeDateParse = (dateStr: string | null | undefined, fallback: Date = new Date()): Date => {
  if (!dateStr) return fallback
  
  try {
    // Handle already parsed dates
    if (dateStr instanceof Date) return dateStr
    
    // Ensure it's a string
    if (typeof dateStr !== 'string') return fallback
    
    // Safely parse ISO strings
    const parsed = parseISO(dateStr)
    
    // Validate the parsed date
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
    
    return fallback
  } catch (error) {
    console.warn('Failed to parse date:', dateStr, error)
    return fallback
  }
}

/**
 * Convert date to local YYYY-MM-DD string
 * Handles timezone issues and corrupted data
 */
export const toLocalDateString = (date: Date | string | null | undefined): string => {
  try {
    const d = safeDateParse(typeof date === 'string' ? date : undefined, typeof date === 'string' ? new Date() : date as Date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch (error) {
    console.warn('Failed to convert date to local string:', date, error)
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Get month boundaries with error handling
 */
export const getMonthBoundaries = (date: Date | string | null | undefined) => {
  const safeDate = safeDateParse(typeof date === 'string' ? date : undefined, typeof date === 'string' ? new Date() : date as Date)
  return {
    start: startOfMonth(safeDate),
    end: endOfMonth(safeDate),
    startKey: toLocalDateString(startOfMonth(safeDate)),
    endKey: toLocalDateString(endOfMonth(safeDate)),
    label: safeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
}

/**
 * Get previous month boundaries
 */
export const getPreviousMonthBoundaries = (date: Date | string | null | undefined) => {
  const safeDate = safeDateParse(typeof date === 'string' ? date : undefined, typeof date === 'string' ? new Date() : date as Date)
  const prev = subMonths(safeDate, 1)
  return getMonthBoundaries(prev)
}

/**
 * Get next month boundaries
 */
export const getNextMonthBoundaries = (date: Date | string | null | undefined) => {
  const safeDate = safeDateParse(typeof date === 'string' ? date : undefined, typeof date === 'string' ? new Date() : date as Date)
  const next = addMonths(safeDate, 1)
  return getMonthBoundaries(next)
}

/**
 * Check if task is paused on a specific date
 * Includes history-based pause status and current pause status
 */
export const isTaskPausedOnDate = (
  task: any,
  dateKey: string,
  dailyProgress?: Record<string, any>
): boolean => {
  // Check history first
  if (dailyProgress && dailyProgress[dateKey]) {
    const historyEntry = dailyProgress[dateKey]
    return historyEntry.source === 'paused' || historyEntry.status === 'paused'
  }
  
  // Check current pause status (only for today)
  const today = toLocalDateString(new Date())
  if (dateKey === today && (task.is_paused || task.paused_at)) {
    return true
  }
  
  return false
}

/**
 * Filter tasks excluding paused ones for analytics
 */
export const filterActiveTasks = (
  tasks: any[],
  dateKey: string,
  includeCompleted: boolean = true
): any[] => {
  return tasks.filter(task => {
    // Skip if paused
    if (isTaskPausedOnDate(task, dateKey, task.daily_progress)) {
      return false
    }
    
    // Skip if deleted
    if (task.deleted_at) {
      return false
    }
    
    // Optionally skip completed (depends on context)
    if (!includeCompleted && (task.status === 'completed' || (task.progress ?? 0) >= 100)) {
      return false
    }
    
    return true
  })
}

/**
 * Validate and recover cache/database state after reconnection
 * Called when app resumes from sleep or regains connectivity
 */
export const validateDateIntegrity = (data: any): boolean => {
  if (!data) return true
  
  if (typeof data === 'string') {
    // Check if it looks like a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
      return safeDateParse(data).toString() !== 'Invalid Date'
    }
  }
  
  return true
}

/**
 * Sanitize analytic data after offline/sleep recovery
 */
export const sanitizeAnalyticsData = (data: any): any => {
  if (!data) return {}
  
  if (typeof data !== 'object') return {}
  
  return {
    ...data,
    daily: Array.isArray(data.daily) 
      ? data.daily.filter((point: any) => {
          if (!point || typeof point !== 'object') return false
          if (!validateDateIntegrity(point.dateKey)) return false
          return true
        })
      : [],
    summary: data.summary && typeof data.summary === 'object' ? data.summary : {}
  }
}
