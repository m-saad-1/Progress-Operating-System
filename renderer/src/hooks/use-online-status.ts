/**
 * ONLINE STATUS HOOK
 * ==================
 * Global online/offline detection with automatic query refetch when connection is restored
 * 
 * KEY FEATURES:
 * - Detects online/offline transitions via browser events
 * - Automatically refetches all queries when connection is restored
 * - Provides real-time online status to components
 * - Ensures data freshness after network recovery
 * - Handles reload scenarios with stale cache invalidation
 */

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export const useOnlineStatus = () => {
  const queryClient = useQueryClient()
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Online Status] Connection restored - refetching all queries')
      setIsOnline(true)
      
      // Refetch all active queries when connection is restored
      // This ensures data freshness after network recovery
      queryClient.refetchQueries({ 
        type: 'active',
        stale: true 
      })
    }

    const handleOffline = () => {
      console.log('[Online Status] Connection lost - using cached data')
      setIsOnline(false)
    }

    // Listen for online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [queryClient])

  return { isOnline }
}
