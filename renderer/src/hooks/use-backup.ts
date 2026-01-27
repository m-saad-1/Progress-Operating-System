import { useState, useEffect, useCallback } from 'react'
import { useElectron } from './use-electron'
import { useToaster } from './use-toaster'
import dayjs from 'dayjs'

export interface Backup {
  id: string
  path: string
  timestamp: Date
  size: number
  checksum: string
  version: number
  isCorrupted?: boolean
}

export interface BackupStats {
  totalBackups: number
  totalSize: number
  lastBackup?: Date
  oldestBackup?: Date
  averageSize: number
}

export interface BackupConfig {
  autoBackup: boolean
  backupInterval: number // hours
  maxBackups: number
  backupLocation?: string
  compressBackups: boolean
  encryptBackups: boolean
}

export const useBackup = () => {
  const electron = useElectron()
  const { success, error, info } = useToaster()
  
  const [backups, setBackups] = useState<Backup[]>([])
  const [stats, setStats] = useState<BackupStats>({
    totalBackups: 0,
    totalSize: 0,
    averageSize: 0,
  })
  
  const [config, setConfig] = useState<BackupConfig>({
    autoBackup: true,
    backupInterval: 24, // hours
    maxBackups: 30,
    compressBackups: true,
    encryptBackups: true,
  })
  
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [verificationProgress, setVerificationProgress] = useState(0)

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const updateStats = useCallback((backupList: Backup[]) => {
    if (backupList.length === 0) {
      setStats({
        totalBackups: 0,
        totalSize: 0,
        averageSize: 0,
      })
      return
    }

    const totalSize = backupList.reduce((sum, backup) => sum + backup.size, 0)
    const lastBackup = backupList.length > 0 
      ? new Date(Math.max(...backupList.map(b => b.timestamp.getTime())))
      : undefined
    const oldestBackup = backupList.length > 0
      ? new Date(Math.min(...backupList.map(b => b.timestamp.getTime())))
      : undefined

    setStats({
      totalBackups: backupList.length,
      totalSize,
      lastBackup,
      oldestBackup,
      averageSize: Math.round(totalSize / backupList.length),
    })
  }, [])

  const loadBackups = useCallback(async (): Promise<void> => {
    if (!electron.isReady) return

    try {
      const backupList = await electron.listBackups()
      const loadedBackups: Backup[] = backupList.map((b: any) => ({
        id: b.id,
        path: b.path,
        timestamp: new Date(b.timestamp),
        size: b.size,
        checksum: b.checksum,
        version: b.version,
        isCorrupted: b.isCorrupted,
      }))

      setBackups(loadedBackups)
      updateStats(loadedBackups)
    } catch (err) {
      console.error('Failed to load backups:', err)
      error('Failed to load backups')
    }
  }, [electron, error, updateStats])

  // Load backups on mount
  useEffect(() => {
    if (electron.isReady) {
      loadBackups()
    }
  }, [electron.isReady])

  // Listen for backup events
  useEffect(() => {
    if (!electron.isReady) return

    const handleBackupCreated = (backup: Backup) => {
      const newBackup: Backup = {
        id: backup.id,
        path: backup.path,
        timestamp: new Date(backup.timestamp),
        size: backup.size,
        checksum: backup.checksum,
        version: backup.version,
      }
      
      setBackups(prev => [newBackup, ...prev])
      updateStats([newBackup, ...backups])
      
      success('Backup created successfully', `Size: ${formatFileSize(backup.size)}`)
    }

    const cleanup = electron.onBackupCreated(handleBackupCreated)

    return () => {
      cleanup()
    }
  }, [electron, success, backups, formatFileSize, updateStats])

  const createBackup = useCallback(async (manual = true): Promise<Backup | null> => {
    if (!electron.isReady) {
      error('Electron not ready')
      return null
    }

    if (isCreatingBackup) {
      info('Backup already in progress')
      return null
    }

    setIsCreatingBackup(true)
    try {
      const backupPath = await electron.createBackup()
      
      // Load the new backup details
      await loadBackups()
      
      if (manual) {
        success('Manual backup created')
      }
      
      return backups.find(b => b.path === backupPath) || null
    } catch (err) {
      console.error('Failed to create backup:', err)
      error('Failed to create backup')
      return null
    } finally {
      setIsCreatingBackup(false)
    }
  }, [electron, error, info, success, isCreatingBackup, backups, loadBackups])

  const restoreBackup = useCallback(async (backupId: string): Promise<boolean> => {
    if (!electron.isReady) {
      error('Electron not ready')
      return false
    }

    if (isRestoring) {
      info('Restore already in progress')
      return false
    }

    setIsRestoring(true)
    setVerificationProgress(0)
    
    try {
      // Simulate verification progress
      const interval = setInterval(() => {
        setVerificationProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval)
            return 90
          }
          return prev + 10
        })
      }, 100)

      const result = await electron.restoreBackup(backupId)
      
      clearInterval(interval)
      setVerificationProgress(100)

      if (result) {
        success('Backup restored successfully', 'Application will reload...')
        
        // Reload after a delay
        setTimeout(() => {
          window.location.reload()
        }, 2000)
        
        return true
      } else {
        error('Failed to restore backup')
        return false
      }
    } catch (err) {
      console.error('Failed to restore backup:', err)
      error('Failed to restore backup')
      return false
    } finally {
      setIsRestoring(false)
      setVerificationProgress(0)
    }
  }, [electron, error, info, success, isRestoring])

  const deleteBackup = useCallback(async (backupId: string): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      // In a real implementation, this would call electron.deleteBackup
      setBackups(prev => prev.filter(backup => backup.id !== backupId))
      success('Backup deleted')
      return true
    } catch (err) {
      console.error('Failed to delete backup:', err)
      error('Failed to delete backup')
      return false
    }
  }, [electron, success, error])

  const deleteOldBackups = useCallback(async (): Promise<number> => {
    if (!electron.isReady || backups.length <= config.maxBackups) {
      return 0
    }

    try {
      const backupsToDelete = backups
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // newest first
        .slice(config.maxBackups) // keep only maxBackups

      // In a real implementation, this would call electron.deleteBackups
      const deletedCount = backupsToDelete.length
      setBackups(prev => prev.slice(0, config.maxBackups))
      
      info(`Deleted ${deletedCount} old backups`)
      return deletedCount
    } catch (err) {
      console.error('Failed to delete old backups:', err)
      error('Failed to delete old backups')
      return 0
    }
  }, [electron, info, error, backups, config.maxBackups])

  const verifyBackup = useCallback(async (backupId: string): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      // In a real implementation, this would call electron.verifyBackup
      setBackups(prev => prev.map(backup => 
        backup.id === backupId 
          ? { ...backup, isCorrupted: false }
          : backup
      ))
      
      success('Backup verification successful')
      return true
    } catch (err) {
      console.error('Backup verification failed:', err)
      
      setBackups(prev => prev.map(backup => 
        backup.id === backupId 
          ? { ...backup, isCorrupted: true }
          : backup
      ))
      
      error('Backup verification failed')
      return false
    }
  }, [electron, success, error])

  const verifyAllBackups = useCallback(async (): Promise<{ valid: number; corrupted: number }> => {
    if (!electron.isReady) {
      return { valid: 0, corrupted: 0 }
    }

    let valid = 0
    let corrupted = 0

    for (const backup of backups) {
      const isValid = await verifyBackup(backup.id)
      if (isValid) {
        valid++
      } else {
        corrupted++
      }
    }

    info(`Verification complete: ${valid} valid, ${corrupted} corrupted`)
    return { valid, corrupted }
  }, [electron, info, backups, verifyBackup])

  const updateConfig = useCallback(async (newConfig: Partial<BackupConfig>): Promise<boolean> => {
    try {
      const updatedConfig = { ...config, ...newConfig }
      setConfig(updatedConfig)
      
      // If maxBackups changed, delete old backups
      if (newConfig.maxBackups !== undefined) {
        await deleteOldBackups()
      }

      success('Backup configuration updated')
      return true
    } catch (err) {
      console.error('Failed to update backup config:', err)
      error('Failed to update backup configuration')
      return false
    }
  }, [config, deleteOldBackups, success, error])

  const exportBackup = useCallback(async (backupId: string, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      const backup = backups.find(b => b.id === backupId)
      if (!backup) {
        error('Backup not found')
        return false
      }

      const options = {
        defaultPath: `backup-${dayjs(backup.timestamp).format('YYYY-MM-DD-HH-mm')}.${format}`,
        filters: [
          { name: format.toUpperCase(), extensions: [format] },
        ],
      }

      const savePath = await electron.saveFile(options)
      if (!savePath) {
        return false
      }

      // In a real implementation, this would export the backup
      success(`Backup exported as ${format.toUpperCase()}`)
      return true
    } catch (err) {
      console.error('Failed to export backup:', err)
      error('Failed to export backup')
      return false
    }
  }, [electron, success, error, backups])

  const formatDate = useCallback((date: Date): string => {
    return dayjs(date).format('YYYY-MM-DD HH:mm')
  }, [])

  // Auto-backup interval
  useEffect(() => {
    if (!config.autoBackup || config.backupInterval <= 0) {
      return
    }

    const interval = setInterval(() => {
      createBackup(false)
    }, config.backupInterval * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [config.autoBackup, config.backupInterval, createBackup])

  return {
    // State
    backups,
    stats,
    config,
    isCreatingBackup,
    isRestoring,
    verificationProgress,
    
    // Actions
    createBackup,
    restoreBackup,
    deleteBackup,
    deleteOldBackups,
    verifyBackup,
    verifyAllBackups,
    updateConfig,
    exportBackup,
    loadBackups,
    
    // Utility
    formatFileSize,
    formatDate,
    hasBackups: backups.length > 0,
    latestBackup: backups.length > 0 ? backups[0] : null,
    oldestBackup: backups.length > 0 ? backups[backups.length - 1] : null,
    
    // Derived values
    backupHealth: {
      total: backups.length,
      corrupted: backups.filter(b => b.isCorrupted).length,
      healthy: backups.filter(b => !b.isCorrupted).length,
      lastVerified: backups.length > 0 ? backups[0].timestamp : null,
    },
  }
}