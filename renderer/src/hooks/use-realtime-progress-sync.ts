/**
 * REAL-TIME PROGRESS SYNCHRONIZATION HOOK
 * ========================================
 * Ensures progress indicators across Dashboard, Analytics, Sidebar, and Header
 * update immediately and consistently when data changes.
 *
 * In Tauri 2.0, mutations happen in-process via the database service.
 * Components call `invalidateProgressData()` directly after mutations.
 * Tauri event listeners via `listen()` from @tauri-apps/api/event can be
 * added here for cross-window or backend-initiated updates in future.
 */

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export const useRealtimeProgressSync = () => {
  const queryClient = useQueryClient()

  /**
   * Invalidate all progress-related queries.
   * This triggers immediate refetch and UI updates across all components.
   */
  const invalidateProgressData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['yesterday-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['task-tab-stats-snapshot'] }),
      queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] }),
      queryClient.invalidateQueries({ queryKey: ['task-range-analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['task-monthly-history'] }),
      queryClient.invalidateQueries({ queryKey: ['habits'] }),
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] }),
      queryClient.invalidateQueries({ queryKey: ['habit-completions-all'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] }),
    ])
  }, [queryClient])

  return { invalidateProgressData }
}

/**
 * Manual invalidation hook for use in mutation callbacks.
 * Call this when you perform an operation that affects progress.
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
      queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
      queryClient.invalidateQueries({ queryKey: ['task-range-analytics'] })
      queryClient.invalidateQueries({ queryKey: ['task-monthly-history'] })
    },
  }
}
