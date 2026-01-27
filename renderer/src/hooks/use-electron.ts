import { useState, useEffect } from 'react'
import { Backup } from '../hooks/use-backup'

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
        return window.electronAPI.executeQuery(query, params)
      }, [] as unknown as T)
    },
    executeTransaction: async (operations: Array<{query: string, params?: any[]}>) => {
      return safeCall(async () => {
        return window.electronAPI.executeTransaction(operations)
      })
    },
    createBackup: async () => {
      return safeCall(async () => {
        return window.electronAPI.createBackup()
      }, '')
    },
    restoreBackup: async (backupId: string) => {
      return safeCall(async () => {
        return window.electronAPI.restoreBackup(backupId)
      }, false)
    },
    listBackups: async () => {
      return safeCall(async () => {
        return window.electronAPI.listBackups()
      }, [])
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
    syncStart: async () => {
      return safeCall(async () => {
        return window.electronAPI.syncStart()
      })
    },
    syncStop: async () => {
      return safeCall(async () => {
        return window.electronAPI.syncStop()
      })
    },
    getSyncStatus: async () => {
      return safeCall(async () => {
        return window.electronAPI.getSyncStatus()
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
      const handler = (event: any, status: any) => callback(status)
      window.electronAPI.onSyncUpdate(handler)
      return () => window.electronAPI.removeSyncUpdate(handler)
    },
    onBackupCreated: (callback: (backup: Backup) => void) => {
      if (!isReady) return () => {}
      const handler = (event: any, backup: Backup) => callback(backup)
      window.electronAPI.onBackupCreated(handler)
      return () => window.electronAPI.removeBackupCreated(handler)
    },
    onDatabaseError: (callback: (error: any) => void) => {
      if (!isReady) return () => {}
      const handler = (event: any, error: any) => callback(error)
      window.electronAPI.onDatabaseError(handler)
      return () => window.electronAPI.removeDatabaseError(handler)
    },
  }
}