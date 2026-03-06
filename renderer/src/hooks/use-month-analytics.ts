/**
 * MONTH-BASED ANALYTICS HOOK
 * ==========================
 * Manages analytics data for a specific month with navigation
 * Supports forward/backward month viewing
 */

import { useState, useMemo, useCallback } from 'react'
import { addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useElectron } from './use-electron'
import { database } from '@/lib/database'
import { toLocalDateString, getMonthBoundaries } from '@/lib/analytics-utils'

export interface MonthNavigationState {
  currentMonthDate: Date
  previousMonthDate: Date
  nextMonthDate: Date
  canGoToNextMonth: boolean
}

export const useMonthAnalytics = () => {
  const electron = useElectron()
  const queryClient = useQueryClient()
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))

  const monthBoundaries = useMemo(() => {
    return getMonthBoundaries(monthDate)
  }, [monthDate])

  const navigationState = useMemo((): MonthNavigationState => ({
    currentMonthDate: monthDate,
    previousMonthDate: subMonths(monthDate, 1),
    nextMonthDate: addMonths(monthDate, 1),
    canGoToNextMonth: addMonths(monthDate, 1) <= new Date(),
  }), [monthDate])

  // Fetch analytics for the current month
  const { data: monthAnalytics, isLoading, error } = useQuery({
    queryKey: ['task-range-analytics', monthBoundaries.startKey, monthBoundaries.endKey],
    queryFn: async () => {
      if (!electron.isReady) return null
      try {
        const snapshot = await database.getTaskRangeAnalyticsSnapshot(
          monthBoundaries.startKey,
          monthBoundaries.endKey
        )
        return snapshot
      } catch (err) {
        console.error('Failed to fetch month analytics:', err)
        throw err
      }
    },
    enabled: electron.isReady,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  })

  const goToPreviousMonth = useCallback(() => {
    setMonthDate(prev => subMonths(prev, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    const next = addMonths(monthDate, 1)
    if (next <= new Date()) {
      setMonthDate(next)
    }
  }, [monthDate])

  const goToCurrentMonth = useCallback(() => {
    setMonthDate(startOfMonth(new Date()))
  }, [])

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['task-range-analytics', monthBoundaries.startKey, monthBoundaries.endKey],
    })
  }, [queryClient, monthBoundaries])

  return {
    monthBoundaries,
    navigationState,
    monthAnalytics,
    isLoading,
    error,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    refreshData,
  }
}

/**
 * Hook for Habit Analytics with month navigation
 */
export const useMonthHabitAnalytics = () => {
  const electron = useElectron()
  const queryClient = useQueryClient()
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))

  const monthBoundaries = useMemo(() => {
    return getMonthBoundaries(monthDate)
  }, [monthDate])

  const navigationState = useMemo((): MonthNavigationState => ({
    currentMonthDate: monthDate,
    previousMonthDate: subMonths(monthDate, 1),
    nextMonthDate: addMonths(monthDate, 1),
    canGoToNextMonth: addMonths(monthDate, 1) <= new Date(),
  }), [monthDate])

  const { data: monthAnalytics, isLoading, error } = useQuery({
    queryKey: ['habit-range-analytics', monthBoundaries.startKey, monthBoundaries.endKey],
    queryFn: async () => {
      if (!electron.isReady) return null
      try {
        // Fetch habit completions for the month
        const completions = await database.getHabitCompletions(
          monthBoundaries.startKey,
          monthBoundaries.endKey
        )
        return { completions, monthLabel: monthBoundaries.label }
      } catch (err) {
        console.error('Failed to fetch habit month analytics:', err)
        throw err
      }
    },
    enabled: electron.isReady,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  })

  const goToPreviousMonth = useCallback(() => {
    setMonthDate(prev => subMonths(prev, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    const next = addMonths(monthDate, 1)
    if (next <= new Date()) {
      setMonthDate(next)
    }
  }, [monthDate])

  const goToCurrentMonth = useCallback(() => {
    setMonthDate(startOfMonth(new Date()))
  }, [])

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['habit-range-analytics', monthBoundaries.startKey, monthBoundaries.endKey],
    })
  }, [queryClient, monthBoundaries])

  return {
    monthBoundaries,
    navigationState,
    monthAnalytics,
    isLoading,
    error,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    refreshData,
  }
}
