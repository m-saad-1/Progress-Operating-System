/**
 * APP LIFECYCLE HOOK
 * ==================
 * Handles application lifecycle events for reliable state management
 * 
 * KEY FEATURES:
 * - Detects window visibility changes (tab switches, minimize/maximize)
 * - Detects page reload and hard reload events
 * - Refetches critical data when app becomes visible
 * - Ensures Zustand store stays synchronized with database
 * - Handles date changes during long-running sessions
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useStore } from '@/store'
import { database } from '@/lib/database'

export const useAppLifecycle = () => {
  const queryClient = useQueryClient()
  const { setInitialData } = useStore()
  const lastVisibleDateRef = useRef(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[App Lifecycle] App became visible - checking for updates')

        const currentDate = format(new Date(), 'yyyy-MM-dd')
        const dateChanged = currentDate !== lastVisibleDateRef.current

        if (dateChanged) {
          console.log(`[App Lifecycle] Date changed: ${lastVisibleDateRef.current} → ${currentDate}`)
          lastVisibleDateRef.current = currentDate
        }

        // Refetch all active queries to ensure fresh data
        // This handles reload, hard reload, and tab activation scenarios
        await queryClient.refetchQueries({ 
          type: 'active',
          stale: true 
        })

        // Also refresh Zustand store from database
        try {
          const [tasks, habits, goals] = await Promise.all([
            database.getTasks(),
            database.getHabits(),
            database.getGoals(),
          ])
          setInitialData({ tasks, habits, goals })
          console.log('[App Lifecycle] Store refreshed from database')
        } catch (error) {
          console.error('[App Lifecycle] Failed to refresh store:', error)
        }
      }
    }

    const handleFocus = () => {
      console.log('[App Lifecycle] Window focused - refetching queries')
      queryClient.refetchQueries({ 
        type: 'active',
        stale: true 
      })
    }

    // Listen for visibility changes (handles tab switches, minimize/restore)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for window focus (handles alt-tab, click on window)
    window.addEventListener('focus', handleFocus)

    // Run once on mount to handle reload scenarios
    handleVisibilityChange()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [queryClient, setInitialData])
}
