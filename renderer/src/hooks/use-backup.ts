import { useState, useEffect, useCallback, useRef } from 'react'
import { useElectron } from './use-electron'
import { useToaster } from './use-toaster'
import { format as formatDateFns } from 'date-fns'

export interface Backup {
  id: string
  path: string
  timestamp: string
  size: number
  checksum: string
  version: number
  exists?: boolean
  sizeFormatted?: string
  dateFormatted?: string
  verified?: boolean | null // null = not yet verified, true/false = result
}

export interface BackupStats {
  totalBackups: number
  totalSize: number
  totalSizeFormatted: string
  oldestBackup: string | null
  newestBackup: string | null
  healthyBackups: number
  missingBackups: number
}

const DEFAULT_STATS: BackupStats = {
  totalBackups: 0,
  totalSize: 0,
  totalSizeFormatted: '0 B',
  oldestBackup: null,
  newestBackup: null,
  healthyBackups: 0,
  missingBackups: 0,
}

export const useBackup = () => {
  const electron = useElectron()
  const { success, error, info } = useToaster()

  const [backups, setBackups] = useState<Backup[]>([])
  const [stats, setStats] = useState<BackupStats>(DEFAULT_STATS)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const loadedRef = useRef(false)

  // ── Helpers ──

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }, [])

  const formatDate = useCallback((ts: string | Date): string => {
    try {
      const d = typeof ts === 'string' ? new Date(ts) : ts
      return formatDateFns(d, 'yyyy-MM-dd HH:mm')
    } catch {
      return String(ts)
    }
  }, [])

  // ── Load backups from main process ──

  const loadBackups = useCallback(async (): Promise<void> => {
    if (!electron.isReady) return

    try {
      const backupList = await electron.listBackups()

      const loaded: Backup[] = (Array.isArray(backupList) ? backupList : []).map((b: any) => ({
        id: b.id,
        path: b.path,
        timestamp: b.timestamp,
        size: b.size ?? 0,
        checksum: b.checksum ?? '',
        version: b.version ?? 1,
        exists: b.exists ?? true,
        sizeFormatted: b.sizeFormatted ?? formatFileSize(b.size ?? 0),
        dateFormatted: b.dateFormatted ?? formatDate(b.timestamp),
        verified: null,
      }))

      setBackups(loaded)
    } catch (err) {
      console.error('Failed to load backups:', err)
      error('Failed to load backups')
    }
  }, [electron, error, formatFileSize, formatDate])

  // ── Load stats from main process ──

  const loadStats = useCallback(async (): Promise<void> => {
    if (!electron.isReady) return

    try {
      const s = await electron.getBackupStats()
      if (s) setStats(s)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [electron])

  // ── Refresh both ──

  const refresh = useCallback(async () => {
    await Promise.all([loadBackups(), loadStats()])
  }, [loadBackups, loadStats])

  // ── Initial load ──

  useEffect(() => {
    if (electron.isReady && !loadedRef.current) {
      loadedRef.current = true
      refresh()
    }
  }, [electron.isReady, refresh])

  // ── Listen for real-time backup:created events ──

  useEffect(() => {
    if (!electron.isReady) return

    const handleBackupCreated = (_backup: any) => {
      // Just reload the full list to stay in sync
      refresh()
    }

    const cleanup = electron.onBackupCreated(handleBackupCreated)
    return () => { cleanup() }
  }, [electron, refresh])

  // ── Create ──

  const createBackup = useCallback(async (): Promise<boolean> => {
    if (!electron.isReady) {
      error('Not ready')
      return false
    }
    if (isCreatingBackup) {
      info('Backup already in progress')
      return false
    }

    setIsCreatingBackup(true)
    try {
      const record = await electron.createBackup()
      if (record) {
        success('Backup created', `Size: ${record.sizeFormatted || formatFileSize(record.size || 0)}`)
        await refresh()
        return true
      }
      error('Failed to create backup')
      return false
    } catch (err: any) {
      console.error('Failed to create backup:', err)
      error(err?.message || 'Failed to create backup')
      return false
    } finally {
      setIsCreatingBackup(false)
    }
  }, [electron, error, info, success, isCreatingBackup, formatFileSize, refresh])

  // ── Restore ──

  const restoreBackup = useCallback(async (backupId: string): Promise<boolean> => {
    if (!electron.isReady) {
      error('Not ready')
      return false
    }
    if (isRestoring) {
      info('Restore already in progress')
      return false
    }

    setIsRestoring(true)
    try {
      const result = await electron.restoreBackup(backupId)

      if (result) {
        success('Backup restored successfully', 'Application will reload…')
        setTimeout(() => window.location.reload(), 2000)
        return true
      }

      error('Failed to restore backup')
      return false
    } catch (err: any) {
      console.error('Failed to restore backup:', err)
      error(err?.message || 'Failed to restore backup')
      return false
    } finally {
      setIsRestoring(false)
    }
  }, [electron, error, info, success, isRestoring])

  // ── Delete ──

  const deleteBackup = useCallback(async (backupId: string): Promise<boolean> => {
    if (!electron.isReady) return false

    try {
      const result = await electron.deleteBackup(backupId)
      if (result) {
        success('Backup deleted')
        await refresh()
        return true
      }
      error('Failed to delete backup')
      return false
    } catch (err: any) {
      console.error('Failed to delete backup:', err)
      error(err?.message || 'Failed to delete backup')
      return false
    }
  }, [electron, success, error, refresh])

  // ── Verify ──

  const verifyBackup = useCallback(async (backupId: string): Promise<boolean> => {
    if (!electron.isReady) return false

    setIsVerifying(true)
    try {
      const result = await electron.verifyBackup(backupId)
      const isValid = result?.valid === true

      setBackups(prev =>
        prev.map(b => (b.id === backupId ? { ...b, verified: isValid } : b))
      )

      if (isValid) {
        success('Backup is valid')
      } else {
        error(`Backup verification failed: ${result?.error || 'Unknown error'}`)
      }
      return isValid
    } catch (err: any) {
      console.error('Backup verification failed:', err)
      setBackups(prev =>
        prev.map(b => (b.id === backupId ? { ...b, verified: false } : b))
      )
      error(err?.message || 'Backup verification failed')
      return false
    } finally {
      setIsVerifying(false)
    }
  }, [electron, success, error])

  // ── Verify all ──

  const verifyAllBackups = useCallback(async (): Promise<{ valid: number; corrupted: number }> => {
    if (!electron.isReady) return { valid: 0, corrupted: 0 }

    setIsVerifying(true)
    let valid = 0
    let corrupted = 0

    for (const b of backups) {
      const isValid = await verifyBackup(b.id)
      if (isValid) valid++
      else corrupted++
    }

    setIsVerifying(false)
    info(`Verification complete: ${valid} valid, ${corrupted} corrupted`)
    return { valid, corrupted }
  }, [electron, info, backups, verifyBackup])

  // ── Export ──

  const exportBackup = useCallback(async (backupId: string): Promise<boolean> => {
    if (!electron.isReady) return false

    try {
      const result = await electron.exportBackup(backupId)
      if (result?.success) {
        success('Backup exported successfully')
        return true
      }
      // Cancelled by user or failed
      if (result?.error && result.error !== 'Export cancelled') {
        error(result.error)
      }
      return false
    } catch (err: any) {
      console.error('Failed to export backup:', err)
      error(err?.message || 'Failed to export backup')
      return false
    }
  }, [electron, success, error])

  // ── Import ──

  const importBackup = useCallback(async (): Promise<boolean> => {
    if (!electron.isReady) return false

    setIsImporting(true)
    try {
      const result = await electron.importBackup()
      if (result?.success) {
        success('Backup imported successfully')
        await refresh()
        return true
      }
      if (result?.error && result.error !== 'Import cancelled') {
        error(result.error)
      }
      return false
    } catch (err: any) {
      console.error('Failed to import backup:', err)
      error(err?.message || 'Failed to import backup')
      return false
    } finally {
      setIsImporting(false)
    }
  }, [electron, success, error, refresh])

  // ── Derived values ──

  const latestBackup = backups.length > 0 ? backups[0] : null
  const oldestBackup = backups.length > 0 ? backups[backups.length - 1] : null
  const missingBackups = backups.filter(b => b.exists === false)
  const verifiedCount = backups.filter(b => b.verified === true).length
  const failedCount = backups.filter(b => b.verified === false).length

  return {
    // State
    backups,
    stats,
    isCreatingBackup,
    isRestoring,
    isVerifying,
    isImporting,

    // Actions
    createBackup,
    restoreBackup,
    deleteBackup,
    verifyBackup,
    verifyAllBackups,
    exportBackup,
    importBackup,
    refresh,
    loadBackups,

    // Utility
    formatFileSize,
    formatDate,

    // Derived
    hasBackups: backups.length > 0,
    latestBackup,
    oldestBackup,
    missingBackups,
    verifiedCount,
    failedCount,
  }
}