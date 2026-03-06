/**
 * REAL-TIME PROGRESS SYNCHRONIZATION HOOK
 * ========================================
 * Ensures progress indicators across Dashboard, Analytics, Sidebar, and Header
 * update immediately and consistently when data changes
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useElectron } from './use-electron'

export const useRealtimeProgressSync = () => {
  const queryClient = useQueryClient()
  const electron = useElectron()

  /**
   * Invalidate all progress-related queries
   * This triggers immediate refetch and UI updates across all components
   */
  const invalidateProgressData = async () => {
    // Invalidate task-related queries
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    await queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
    await queryClient.invalidateQueries({ queryKey: ['yesterday-tasks'] })
    await queryClient.invalidateQueries({ queryKey: ['task-tab-stats-snapshot'] })
    await queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
    await queryClient.invalidateQueries({ queryKey: ['task-range-analytics'] })
    await queryClient.invalidateQueries({ queryKey: ['task-monthly-history'] })
    
    // Invalidate habit-related queries
    await queryClient.invalidateQueries({ queryKey: ['habits'] })
    await queryClient.invalidateQueries({ queryKey: ['habit-completions'] })
    await queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] })
    
    // Invalidate analyt ics queries
    await queryClient.invalidateQueries({ queryKey: ['analytics'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    
    // Invalidate productivity and progress queries
    await queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
  }

  /**
   * Listen for task mutations and invalidate related queries
   * This hook should be called in a child component of QueryClientProvider
   */
  useEffect(() => {
    if (!electron.isReady) return

    // Listen for custom events that indicate data changes
    const handleTaskUpdate = () => {
      // Debounce to avoid multiple invalidations in quick succession
      invalidateProgressData()
    }

    // Listen for IPC messages about updates
    if (window.electronAPI && window.electronAPI.on) {
      // Task update event
      window.electronAPI.on?.('task-updated', handleTaskUpdate)
      window.electronAPI.on?.('task-created', handleTaskUpdate)
      window.electronAPI.on?.('task-deleted', handleTaskUpdate)
      window.electronAPI.on?.('task-status-changed', handleTaskUpdate)
      
      // Habit update event
      window.electronAPI.on?.('habit-updated', handleTaskUpdate)
      window.electronAPI.on?.('habit-completed', handleTaskUpdate)
      window.electronAPI.on?.('habit-deleted', handleTaskUpdate)
    }

    return () => {
      // Cleanup listeners
      if (window.electronAPI && window.electronAPI.off) {
        window.electronAPI.off?.('task-updated', handleTaskUpdate)
        window.electronAPI.off?.('task-created', handleTaskUpdate)
        window.electronAPI.off?.('task-deleted', handleTaskUpdate)
        window.electronAPI.off?.('task-status-changed', handleTaskUpdate)
        window.electronAPI.off?.('habit-updated', handleTaskUpdate)
        window.electronAPI.off?.('habit-completed', handleTaskUpdate)
        window.electronAPI.off?.('habit-deleted', handleTaskUpdate)
      }
    }
  }, [electron.isReady, queryClient])

  return {
    invalidateProgressData,
  }
}

/**
 * Manual invalidation hook for use in mutation callbacks
 * Call this when you perform an operation that affects progress
 */
export const useInvalidateProgress = () => {
  const queryClient = useQueryClient()

  return {
    invalidateTaskData: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-tab-stats-snapshot'] })
      queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
      queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
    },

    invalidateHabitData: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] })
      queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
    },

    invalidateAllProgress: async () => {
      await queryClient.invalidateQueries()
    },

    invalidateDashboard: () => {
      queryClient.invalidateQueries({ queryKey: ['task-tab-stats-snapshot'] })
      queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
    },

    invalidateAnalytics: () => {
      queryClient.invalidateQueries({ queryKey: ['task-analyt ics-chart'] })
      queryClient.invalidateQueries({ queryKey: ['task-range-analytics'] })
      queryClient.invalidateQueries({ queryKey: ['task-monthly-history'] })
    },
  }
}
