/**
 * OFFLINE QUEUE HOOK
 * ==================
 * Manages operations that need to be queued when offline
 * and synced when connectivity returns
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useOnlineStatus } from './use-online-status'
import { useToaster } from './use-toaster'

export interface OfflineOperation {
  id: string
  type: 'task-update' | 'task-create' | 'habit-complete' | 'note-create' | 'note-update'
  data: any
  timestamp: number
  retries: number
  maxRetries: number
}

const OFFLINE_QUEUE_KEY = 'progress-os-offline-queue'

/**
 * Hook for managing offline operations
 * Automatically persists to localStorage and retries on reconnection
 */
export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<OfflineOperation[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const isOnline = useOnlineStatus()
  const { warning, success, error: showError } = useToaster()
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setQueue(parsed)
          if (parsed.length > 0) {
            warning(`${parsed.length} offline operation(s) waiting to sync`, 'Offline mode detected')
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load offline queue:', err)
    }
  }, [])

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    } catch (err) {
      console.warn('Failed to persist offline queue:', err)
    }
  }, [queue])

  // Add operation to queue
  const addOperation = useCallback((
    type: OfflineOperation['type'],
    data: any,
    maxRetries: number = 3
  ): string => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const operation: OfflineOperation = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
    }

    setQueue(prev => [...prev, operation])

    if (!isOnline) {
      warning(`Operation queued for sync`, `Your ${type} will sync when online`)
    }

    return id
  }, [isOnline, warning])

  // Remove operation from queue
  const removeOperation = useCallback((id: string) => {
    setQueue(prev => prev.filter(op => op.id !== id))
  }, [])

  // Mark operation as synced
  const markAsSynced = useCallback((id: string) => {
    removeOperation(id)
  }, [removeOperation])

  // Retry operation
  const retryOperation = useCallback((id: string) => {
    setQueue(prev => prev.map(op =>
      op.id === id ? { ...op, retries: op.retries + 1 } : op
    ))
  }, [])

  // Get failed operations (exceeded max retries)
  const failedOperations = queue.filter(op => op.retries >= op.maxRetries)

  // Trigger sync when coming back online
  useEffect(() => {
    if (!isOnline || queue.length === 0) return

    // Clear any pending timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Debounce sync to avoid multiple calls
    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncing(true)
      try {
        // Dispatch custom event for app to handle sync
        window.dispatchEvent(new CustomEvent('offline-sync-triggered', {
          detail: { operations: queue }
        }))

        success('Starting offline sync...', 'Back online')
      } catch (err) {
        console.error('Sync error:', err)
        showError('Sync failed', 'Check logs for details')
      } finally {
        setIsSyncing(false)
      }
    }, 500)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [isOnline, queue.length, success, showError])

  return {
    queue,
    isOnline,
    isSyncing,
    addOperation,
    removeOperation,
    markAsSynced,
    retryOperation,
    failedOperations,
    queueLength: queue.length,
    hasPendingOperations: queue.length > 0,
  }
}

/**
 * Hook to handle offline sync events
 * Can be used in a central location (like App.tsx) to process queued operations
 */
export const useOfflineSyncHandler = (onSync?: (operations: OfflineOperation[]) => Promise<void>) => {
  useEffect(() => {
    const handleSync = async (event: Event) => {
      const customEvent = event as CustomEvent<{ operations: OfflineOperation[] }>
      const operations = customEvent.detail.operations

      if (onSync) {
        try {
          await onSync(operations)
        } catch (err) {
          console.error('Offline sync handler error:', err)
        }
      }
    }

    window.addEventListener('offline-sync-triggered', handleSync)
    return () => window.removeEventListener('offline-sync-triggered', handleSync)
  }, [onSync])
}
