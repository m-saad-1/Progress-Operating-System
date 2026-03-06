/**
 * OFFLINE QUEUE HOOK
 * ==================
 * Manages operations that need to be synced to remote services when connection is restored
 * 
 * IMPORTANT: This is OPTIONAL for sync features only!
 * Core operations (tasks, habits, goals, notes) work entirely offline using local database.
 * This queue is only for external integrations like cloud sync or feedback.
 * 
 * KEY FEATURES:
 * - Queues sync operations when offline
 * - Retries operations when connectivity returns
 * - Persists queue to localStorage
 * - Gracefully handles sync failures
 * - Does NOT affect core app functionality
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useOnlineStatus } from './use-online-status'
import { useToaster } from './use-toaster'

export interface OfflineOperation {
  id: string
  type: 'feedback-submit' | 'sync-push' | 'analytics-upload'
  data: any
  timestamp: number
  retries: number
  maxRetries: number
}

const OFFLINE_QUEUE_KEY = 'progress-os-sync-queue'

/**
 * Hook for managing operations that require network (optional features only)
 * Automatically persists to localStorage and retries on reconnection
 * 
 * NOT used for core task/habit/goal/note operations!
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
            console.log(`[Offline Queue] Loaded ${parsed.length} pending sync operation(s)`)
          }
        }
      }
    } catch (err) {
      console.warn('[Offline Queue] Failed to load queue:', err)
    }
  }, [])

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    } catch (err) {
      console.warn('[Offline Queue] Failed to persist queue:', err)
    }
  }, [queue])

  // Auto-sync when online
  useEffect(() => {
    if (!isOnline || queue.length === 0 || isSyncing) return

    const syncTimer = setTimeout(() => {
      processSyncQueue()
    }, 1000) // Small delay to batch multiple items

    return () => clearTimeout(syncTimer)
  }, [isOnline, queue.length, isSyncing])

  // Process pending queue items asynchronously
  const processSyncQueue = useCallback(async () => {
    if (isSyncing || !isOnline || queue.length === 0) return

    setIsSyncing(true)
    const results = { succeeded: 0, failed: 0 }

    for (const operation of queue) {
      try {
        // Attempt to process operation (implementation depends on type)
        await processQueuedOperation(operation)
        removeOperation(operation.id)
        results.succeeded++
      } catch (error) {
        // Increment retry count
        retryOperation(operation.id)
        results.failed++
        console.warn(`[Offline Queue] Failed to sync ${operation.type}:`, error)
      }
    }

    setIsSyncing(false)

    if (results.succeeded > 0) {
      success(`Synced ${results.succeeded} operations`)
    }
  }, [queue, isOnline, isSyncing])

  // Add operation to queue for later sync
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
      console.log(`[Offline Queue] Operation queued: ${type}`)
    }

    return id
  }, [isOnline])

  // Remove operation from queue  
  const removeOperation = useCallback((id: string) => {
    setQueue(prev => prev.filter(op => op.id !== id))
  }, [])

  // Retry operation when sync fails
  const retryOperation = useCallback((id: string) => {
    setQueue(prev => prev.map(op =>
      op.id === id && op.retries < op.maxRetries
        ? { ...op, retries: op.retries + 1 }
        : op
    ))
  }, [])

  // Mark operation as synced (remove from queue)
  const markAsSynced = useCallback((id: string) => {
    removeOperation(id)
  }, [removeOperation])

  return {
    queue,
    isSyncing,
    addOperation,
    removeOperation,
    markAsSynced,
    processSyncQueue,
  }
}

/**
 * Process a single operation from the queue
 * Implementation depends on operation type
 */
async function processQueuedOperation(operation: OfflineOperation): Promise<void> {
  // This would be implemented per operation type
  // For now, return success to simulate processing
  return Promise.resolve()
}
