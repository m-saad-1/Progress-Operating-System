import { useState, useEffect } from 'react'

export const useElectron = () => {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const checkElectron = () => {
      const electronAvailable = typeof window !== 'undefined' && !!window.electronAPI
      setIsReady(electronAvailable)
      
      if (!electronAvailable) {
        console.warn('Electron API not available. Running in development mode.')
      }
    }
    
    checkElectron()
    
    const timeout = setTimeout(checkElectron, 1000)
    
    return () => clearTimeout(timeout)
  }, [])

  const safeCall = async <T,>(
    fn: () => Promise<T>,
    fallback?: T
  ): Promise<T> => {
    try {
      if (!isReady) {
        throw new Error('Electron API not available')
      }
      return await fn()
    } catch (error) {
      console.error('Electron API call failed:', error)
      
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
        const response = await window.electronAPI.executeQuery(query, params)
        // Handle wrapped response from IPC { success: boolean, data: any, error?: string }
        if (response && typeof response === 'object' && 'success' in response) {
          if (!response.success) {
            throw new Error(response.error || 'Query failed')
          }
          const data = response.data
          return Array.isArray(data) ? data : [] as unknown as T
        }
        // Handle direct response (fallback for older API)
        return Array.isArray(response) ? response : [] as unknown as T
      }, [] as unknown as T)
    },
    executeTransaction: async (operations: Array<{query: string, params?: any[]}>) => {
      return safeCall(async () => {
        const response = await window.electronAPI.executeTransaction(operations)
        // Handle wrapped response from IPC
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
      return safeCall(async () => {
        const res = await window.electronAPI.createBackup()
        if (res && !res.success) throw new Error(res.error || 'Backup failed')
        return res?.data || res
      })
    },
    restoreBackup: async (backupId: string) => {
      return safeCall(async () => {
        const res = await window.electronAPI.restoreBackup(backupId)
        if (res && !res.success) throw new Error(res.error || 'Restore failed')
        return true
      }, false)
    },
    listBackups: async () => {
      return safeCall(async () => {
        const res = await window.electronAPI.listBackups()
        if (res && !res.success) throw new Error(res.error || 'List failed')
        return res?.data || []
      }, [])
    },
    deleteBackup: async (backupId: string) => {
      return safeCall(async () => {
        const res = await window.electronAPI.deleteBackup(backupId)
        if (res && !res.success) throw new Error(res.error || 'Delete failed')
        return true
      }, false)
    },
    verifyBackup: async (backupId: string) => {
      return safeCall(async () => {
        const res = await window.electronAPI.verifyBackup(backupId)
        if (res && !res.success) throw new Error(res.error || 'Verify failed')
        return res?.data || { valid: false }
      }, { valid: false })
    },
    getBackupStats: async () => {
      return safeCall(async () => {
        const res = await window.electronAPI.getBackupStats()
        if (res && !res.success) throw new Error(res.error || 'Stats failed')
        return res?.data || null
      }, null)
    },
    exportBackup: async (backupId: string) => {
      return safeCall(async () => {
        const res = await window.electronAPI.exportBackup(backupId)
        return res
      }, { success: false })
    },
    importBackup: async () => {
      return safeCall(async () => {
        const res = await window.electronAPI.importBackup()
        return res
      }, { success: false })
    },
    selectFile: async (options: any) => {
      return safeCall(async () => {
        return window.electronAPI.selectFile(options)
      }, null)
    },
    saveFile: async (options: any) => {
      return safeCall(async () => {
        return window.electronAPI.saveFile(options)
      }, null)
    },
    getAppPath: async (name: string) => {
      return safeCall(async () => {
        return window.electronAPI.getAppPath(name)
      }, '')
    },
    getPlatform: () => {
      if (!isReady) return 'web'
      try {
        return window.electronAPI.getPlatform()
      } catch {
        return 'unknown'
      }
    },
    resetAllData: async () => {
      return safeCall(async () => {
        const res = await window.electronAPI.resetAllData()
        if (res && typeof res === 'object' && 'success' in (res as any)) {
          if (!(res as any).success) {
            throw new Error((res as any).error || 'Reset failed')
          }
        }
        return res
      }, false)
    },
    syncStart: async () => {
      return safeCall(async () => {
        const res: any = await window.electronAPI.syncStart()
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          throw new Error(res.error || 'Sync start failed')
        }
        return res
      })
    },
    syncStop: async () => {
      return safeCall(async () => {
        const res: any = await window.electronAPI.syncStop()
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          throw new Error(res.error || 'Sync stop failed')
        }
        return res
      })
    },
    setSyncConfig: async (config: any) => {
      return safeCall(async () => {
        const res: any = await window.electronAPI.setSyncConfig(config)
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          throw new Error(res.error || 'Sync config failed')
        }
        return res
      })
    },
    getSyncStatus: async () => {
      return safeCall(async () => {
        const res = await window.electronAPI.getSyncStatus()
        if (res && typeof res === 'object' && 'success' in res) {
          if (!res.success) {
            throw new Error(res.error || 'Sync status failed')
          }
          return res.status ?? res.data ?? { status: 'idle' }
        }
        return res
      }, { status: 'idle' })
    },
    undo: async () => {
      return safeCall(async () => {
        return window.electronAPI.undo()
      }, false)
    },
    redo: async () => {
      return safeCall(async () => {
        return window.electronAPI.redo()
      }, false)
    },
    getUndoStack: async () => {
      return safeCall(async () => {
        return window.electronAPI.getUndoStack()
      }, { canUndo: false, canRedo: false, undoStack: [], redoStack: [] })
    },
    onSyncUpdate: (callback: (status: any) => void) => {
      if (!isReady) return () => {}
      const handler = (_event: any, status: any) => callback(status)
      window.electronAPI.onSyncUpdate(handler)
      return () => window.electronAPI.removeSyncUpdate(handler)
    },
    onBackupCreated: (callback: (backup: any) => void) => {
      if (!isReady) return () => {}
      const handler = (_event: any, backup: any) => callback(backup)
      window.electronAPI.onBackupCreated(handler)
      return () => window.electronAPI.removeBackupCreated(handler)
    },
    onDatabaseError: (callback: (error: any) => void) => {
      if (!isReady) return () => {}
      const handler = (_event: any, error: any) => callback(error)
      window.electronAPI.onDatabaseError(handler)
      return () => window.electronAPI.removeDatabaseError(handler)
    },
  }
}