import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { type as osType } from '@tauri-apps/plugin-os'

export const useTauri = () => {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const checkTauri = () => {
      const tauriAvailable = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__
      setIsReady(tauriAvailable)
      
      if (!tauriAvailable) {
        console.warn('Tauri API not available. Running in development mode.')
      }
    }
    
    checkTauri()
    
    const timeout = setTimeout(checkTauri, 1000)
    
    return () => clearTimeout(timeout)
  }, [])

  const safeCall = async <T,>(
    fn: () => Promise<T>,
    fallback?: T
  ): Promise<T> => {
    try {
      if (!isReady) {
        throw new Error('Tauri API not available')
      }
      return await fn()
    } catch (error) {
      console.warn('Tauri API call failed (mocking response):', error)
      
      if (fallback !== undefined) {
        return fallback
      }
      
      throw error
    }
  }

  return {
    isReady,
    executeQuery: async <T extends any[]>(query: string, params?: any[]) => {
      return safeCall(async () => {
        const response: any = await invoke('execute_query', { query, params })
        if (response && typeof response === 'object' && 'success' in response) {
          if (!response.success) {
            throw new Error(response.error || 'Query failed')
          }
          const data = response.data
          return Array.isArray(data) ? data : [] as unknown as T
        }
        return Array.isArray(response) ? response : [] as unknown as T
      }, [] as unknown as T)
    },
    executeTransaction: async (operations: Array<{query: string, params?: any[]}>) => {
      return safeCall(async () => {
        const response: any = await invoke('execute_transaction', { operations })
        if (response && typeof response === 'object' && 'success' in response) {
          if (!response.success) {
            throw new Error(response.error || 'Transaction failed')
          }
          return response.data
        }
        return response
      })
    },
    createBackup: async () => {
      return safeCall(async () => invoke('create_backup'), { success: false })
    },
    restoreBackup: async (backupId: string) => {
      return safeCall(async () => invoke('restore_backup', { backupId }), false)
    },
    listBackups: async () => {
      return safeCall(async () => invoke('list_backups'), [])
    },
    deleteBackup: async (backupId: string) => {
      return safeCall(async () => invoke('delete_backup', { backupId }), false)
    },
    verifyBackup: async (backupId: string) => {
      return safeCall(async () => invoke('verify_backup', { backupId }), { valid: false })
    },
    getBackupStats: async () => {
      return safeCall(async () => invoke('get_backup_stats'), null)
    },
    exportBackup: async (backupId: string) => {
      return safeCall(async () => invoke('export_backup', { backupId }), { success: false })
    },
    importBackup: async () => {
      return safeCall(async () => invoke('import_backup'), { success: false })
    },
    selectFile: async (options: any) => {
      return safeCall(async () => {
        return open({
          multiple: options?.properties?.includes('multiSelections'),
          directory: options?.properties?.includes('openDirectory'),
          filters: options?.filters?.map((f: any) => ({ name: f.name, extensions: f.extensions }))
        })
      }, null)
    },
    saveFile: async (options: any) => {
      return safeCall(async () => {
        return save({
          defaultPath: options?.defaultPath,
          filters: options?.filters?.map((f: any) => ({ name: f.name, extensions: f.extensions }))
        })
      }, null)
    },
    getAppPath: async (name: string) => {
      return safeCall(async () => {
        return invoke('get_app_path', { name })
      }, '')
    },
    getPlatform: () => {
      if (!isReady) return 'web'
      try {
        const os = osType()
        if (os === 'windows') return 'win32'
        if (os === 'macos') return 'darwin'
        if (os === 'linux') return 'linux'
        return os
      } catch {
        return 'unknown'
      }
    },
    resetAllData: async () => {
      return safeCall(async () => invoke('reset_all_data'), false)
    },
    syncStart: async () => {
      return safeCall(async () => invoke('sync_start'))
    },
    syncStop: async () => {
      return safeCall(async () => invoke('sync_stop'))
    },
    setSyncConfig: async (config: any) => {
      return safeCall(async () => invoke('set_sync_config', { config }))
    },
    getSyncStatus: async () => {
      return safeCall(async () => invoke('get_sync_status'), { status: 'idle' })
    },
    undo: async () => {
      return safeCall(async () => invoke('undo'), false)
    },
    redo: async () => {
      return safeCall(async () => invoke('redo'), false)
    },
    getUndoStack: async () => {
      return safeCall(async () => invoke('get_undo_stack'), { canUndo: false, canRedo: false, undoStack: [], redoStack: [] })
    },
    onSyncUpdate: (callback: (status: any) => void) => {
      if (!isReady) return () => {}
      const unlistenPromise = listen('sync-update', (event) => callback(event.payload))
      return () => {
        unlistenPromise.then(unlisten => unlisten())
      }
    },
    onBackupCreated: (callback: (backup: any) => void) => {
      if (!isReady) return () => {}
      const unlistenPromise = listen('backup-created', (event) => callback(event.payload))
      return () => {
        unlistenPromise.then(unlisten => unlisten())
      }
    },
    onDatabaseError: (callback: (error: any) => void) => {
      if (!isReady) return () => {}
      const unlistenPromise = listen('database-error', (event) => callback(event.payload))
      return () => {
        unlistenPromise.then(unlisten => unlisten())
      }
    },
  }
}