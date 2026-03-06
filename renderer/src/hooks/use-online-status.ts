/**
 * ONLINE STATUS HOOK
 * ==================
 * Tracks online/offline status for informational/UI purposes only
 * Does NOT block core functionality - all operations are offline-first
 * 
 * KEY FEATURES:
 * - Detects online/offline transitions via browser events
 * - Provides real-time status to components (e.g., showing sync status, optional features)
 * - Does NOT refetch queries or block mutations
 * - Does NOT impact core task/habit/note/goal operations
 * - Optional features (feedback, sync) can use this to queue operations
 */

import { useEffect, useState } from 'react'

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Online Status] Connection restored')
      setIsOnline(true)
      // Note: We do NOT refetch queries here because:
      // 1. All operations are 100% local-first using local database
      // 2. Any sync/remote features are optional and can be triggered separately
      // 3. Connection restoration doesn't affect core functionality
    }

    const handleOffline = () => {
      console.log('[Online Status] Connection lost - app continues working offline')
      setIsOnline(false)
      // Core operations continue unaffected
    }

    // Listen for online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
