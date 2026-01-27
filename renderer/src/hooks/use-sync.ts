import { useState, useEffect, useCallback } from 'react'
import { useElectron } from './use-electron'
import { useToaster } from './use-toaster'
import { useStore } from '@/store'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSync?: Date
  nextSync?: Date
  error?: string
  conflicts: any[]
  progress: number
  stats: {
    uploaded: number
    downloaded: number
    conflicts: number
  }
}

export interface SyncConfig {
  enabled: boolean
  provider: 'supabase' | 'firebase' | 'custom'
  endpoint?: string
  apiKey?: string
  syncInterval: number // minutes
  autoSync: boolean
  syncOnStartup: boolean
  conflictResolution: 'local' | 'remote' | 'manual'
}

export const useSync = () => {
  const electron = useElectron()
  const { success, error, warning, info } = useToaster()
  const store = useStore()
  
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    conflicts: [],
    progress: 0,
    stats: {
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
    },
  })

  const [config, setConfig] = useState<SyncConfig>({
    enabled: store.syncEnabled,
    provider: 'supabase',
    syncInterval: 5,
    autoSync: true,
    syncOnStartup: true,
    conflictResolution: 'manual',
  })

  // Load sync config from store
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      enabled: store.syncEnabled,
    }))
  }, [store.syncEnabled])

  // Listen for sync events from electron
  useEffect(() => {
    if (!electron.isReady) return

    const handleSyncUpdate = (syncStatus: any) => {
      setState(prev => ({
        ...prev,
        status: syncStatus.status,
        progress: syncStatus.progress || 0,
        lastSync: syncStatus.lastSync ? new Date(syncStatus.lastSync) : undefined,
        nextSync: syncStatus.nextSync ? new Date(syncStatus.nextSync) : undefined,
        error: syncStatus.error,
        stats: syncStatus.stats || prev.stats,
        conflicts: syncStatus.conflicts || prev.conflicts,
      }))

      // Update store
      store.updateSyncStatus(syncStatus.status)
      if (syncStatus.lastSync) {
        store.updateLastSync()
      }

      // Show toast notifications
      if (syncStatus.status === 'success') {
        success('Sync completed successfully', `Uploaded: ${syncStatus.stats?.uploaded}, Downloaded: ${syncStatus.stats?.downloaded}`)
      } else if (syncStatus.status === 'error') {
        error('Sync failed', syncStatus.error)
      } else if (syncStatus.status === 'conflict') {
        warning('Sync conflicts detected', 'Please resolve conflicts')
      }
    }

    const handleDatabaseError = (dbError: any) => {
      error('Database error during sync', dbError.message)
      setState(prev => ({
        ...prev,
        status: 'error',
        error: dbError.message,
      }))
    }

    const cleanupSync = electron.onSyncUpdate(handleSyncUpdate)
    const cleanupDb = electron.onDatabaseError(handleDatabaseError)

    return () => {
      cleanupSync()
      cleanupDb()
    }
  }, [electron, success, error, warning, store])

  const startSync = useCallback(async (force = false): Promise<boolean> => {
    if (!electron.isReady) {
      error('Electron not ready')
      return false
    }

    if (!config.enabled && !force) {
      info('Sync is disabled. Enable it in settings.')
      return false
    }

    try {
      setState(prev => ({ ...prev, status: 'syncing', progress: 0 }))
      await electron.syncStart()
      return true
    } catch (err) {
      console.error('Failed to start sync:', err)
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      }))
      error('Failed to start sync')
      return false
    }
  }, [electron, config.enabled, error, info])

  const stopSync = useCallback(async (): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      await electron.syncStop()
      setState(prev => ({ ...prev, status: 'idle' }))
      info('Sync stopped')
      return true
    } catch (err) {
      console.error('Failed to stop sync:', err)
      error('Failed to stop sync')
      return false
    }
  }, [electron, info, error])

  const getSyncStatus = useCallback(async (): Promise<SyncState> => {
    if (!electron.isReady) {
      return state
    }

    try {
      const status = await electron.getSyncStatus()
      return {
        status: status.status || 'idle',
        lastSync: status.lastSync ? new Date(status.lastSync) : undefined,
        nextSync: status.nextSync ? new Date(status.nextSync) : undefined,
        error: status.error,
        conflicts: status.conflicts || [],
        progress: status.progress || 0,
        stats: status.stats || { uploaded: 0, downloaded: 0, conflicts: 0 },
      }
    } catch (err) {
      console.error('Failed to get sync status:', err)
      return state
    }
  }, [electron, state])

  const updateConfig = useCallback(async (newConfig: Partial<SyncConfig>): Promise<boolean> => {
    try {
      const updatedConfig = { ...config, ...newConfig }
      setConfig(updatedConfig)
      
      // Update store
      if (newConfig.enabled !== undefined) {
        store.enableSync(newConfig.enabled)
      }

      // If enabling sync, start it
      if (newConfig.enabled && !config.enabled) {
        await startSync(true)
      }

      success('Sync configuration updated')
      return true
    } catch (err) {
      console.error('Failed to update sync config:', err)
      error('Failed to update sync configuration')
      return false
    }
  }, [config, store, startSync, success, error])

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      // In a real implementation, this would call electron.resolveConflict
      setState(prev => ({
        ...prev,
        conflicts: prev.conflicts.filter(c => c.id !== conflictId),
        stats: {
          ...prev.stats,
          conflicts: prev.stats.conflicts - 1,
        },
      }))

      success('Conflict resolved')
      return true
    } catch (err) {
      console.error('Failed to resolve conflict:', err)
      error('Failed to resolve conflict')
      return false
    }
  }, [electron, success, error])

  const resolveAllConflicts = useCallback(async (
    resolution: 'local' | 'remote'
  ): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      // In a real implementation, this would call electron.resolveAllConflicts
      setState(prev => ({
        ...prev,
        conflicts: [],
        stats: {
          ...prev.stats,
          conflicts: 0,
        },
      }))

      success('All conflicts resolved')
      return true
    } catch (err) {
      console.error('Failed to resolve all conflicts:', err)
      error('Failed to resolve conflicts')
      return false
    }
  }, [electron, success, error])

  const forceSync = useCallback(async (): Promise<boolean> => {
    return startSync(true)
  }, [startSync])

  const resetSync = useCallback(async (): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      // Stop any ongoing sync
      await stopSync()
      
      // Reset state
      setState({
        status: 'idle',
        conflicts: [],
        progress: 0,
        stats: {
          uploaded: 0,
          downloaded: 0,
          conflicts: 0,
        },
      })

      success('Sync reset successfully')
      return true
    } catch (err) {
      console.error('Failed to reset sync:', err)
      error('Failed to reset sync')
      return false
    }
  }, [electron, stopSync, success, error])

  // Auto-sync interval
  useEffect(() => {
    if (!config.enabled || !config.autoSync || config.syncInterval <= 0) {
      return
    }

    const interval = setInterval(() => {
      if (state.status === 'idle') {
        startSync()
      }
    }, config.syncInterval * 60 * 1000)

    return () => clearInterval(interval)
  }, [config.enabled, config.autoSync, config.syncInterval, state.status, startSync])

  // Initial sync on startup
  useEffect(() => {
    if (config.enabled && config.syncOnStartup && electron.isReady) {
      const timer = setTimeout(() => {
        startSync()
      }, 2000) // Wait 2 seconds for app to initialize

      return () => clearTimeout(timer)
    }
  }, [config.enabled, config.syncOnStartup, electron.isReady, startSync])

  return {
    // State
    state,
    config,
    
    // Actions
    startSync,
    stopSync,
    forceSync,
    resetSync,
    updateConfig,
    resolveConflict,
    resolveAllConflicts,
    getSyncStatus,
    
    // Derived values
    isSyncing: state.status === 'syncing',
    hasConflicts: state.conflicts.length > 0,
    lastSyncTime: state.lastSync,
    nextSyncTime: state.nextSync,
    
    // Statistics
    totalOperations: state.stats.uploaded + state.stats.downloaded,
    syncProgress: state.progress,
    
    // Utility
    canSync: electron.isReady && config.enabled,
  }
}