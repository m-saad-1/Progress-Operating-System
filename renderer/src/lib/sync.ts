import { useStore } from '@/store'
import { database } from '@/lib/database'

let initialized = false
let autoSyncTimer: number | null = null

const setAutoSyncTimer = () => {
  if (autoSyncTimer) {
    window.clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }

  const state = useStore.getState()
  if (!state.syncEnabled || !state.autoSync || state.syncInterval <= 0) return

  autoSyncTimer = window.setInterval(() => {
    void runSyncCycle()
  }, state.syncInterval * 60 * 1000)
}

const applySyncConfig = async () => {
  const state = useStore.getState()
  if (!window.electronAPI?.invoke) return

  await window.electronAPI.invoke('sync:setConfig', {
    enabled: state.syncEnabled,
    provider: state.syncProvider,
    syncInterval: state.syncInterval,
  })
}

const runSyncCycle = async () => {
  const state = useStore.getState()
  if (!state.syncEnabled) return

  try {
    state.updateSyncStatus('syncing')

    const [notes, reviews, timeBlocks] = await Promise.all([
      database.getNotes().catch(() => []),
      database.getReviews(undefined, 1000).catch(() => []),
      database.getTimeBlocks().catch(() => []),
    ])

    localStorage.setItem(
      'progress-os-sync-snapshot',
      JSON.stringify({
        syncedAt: new Date().toISOString(),
        provider: state.syncProvider,
        tasks: state.tasks,
        habits: state.habits,
        goals: state.goals,
        userProfile: state.userProfile,
        notes,
        reviews,
        timeBlocks,
        settings: {
          timezone: state.timezone,
          weekStart: state.weekStart,
          language: state.language,
          highContrastMode: state.highContrastMode,
          notificationSettings: state.notificationSettings,
          privacySettings: state.privacySettings,
          keyboardShortcutsEnabled: state.keyboardShortcutsEnabled,
          keyboardShortcuts: state.keyboardShortcuts,
        },
      })
    )

    if (window.electronAPI && state.syncProvider !== 'local') {
      await applySyncConfig()
      const syncResult: any = await window.electronAPI.syncStart()
      if (syncResult && typeof syncResult === 'object' && 'success' in syncResult && !syncResult.success) {
        throw new Error(syncResult.error || 'Sync cycle failed')
      }
    }

    state.updateLastSync()
    state.updateSyncStatus('idle')
  } catch (error) {
    console.error('Sync cycle failed:', error)
    useStore.getState().updateSyncStatus('error')
  }
}

export const setupSyncManager = () => {
  if (initialized) return
  initialized = true

  const store = useStore.getState()

  const handleSyncUpdate = (_event: any, status: any) => {
    const latestStore = useStore.getState()
    if (status?.status === 'syncing') {
      latestStore.updateSyncStatus('syncing')
      return
    }

    if (status?.status === 'error') {
      latestStore.updateSyncStatus('error')
      return
    }

    latestStore.updateLastSync()
    latestStore.updateSyncStatus('idle')
  }

  if (window.electronAPI?.onSyncUpdate) {
    window.electronAPI.onSyncUpdate(handleSyncUpdate)
  }

  useStore.subscribe((state, prev) => {
    const syncSettingsChanged =
      state.syncEnabled !== prev.syncEnabled ||
      state.syncProvider !== prev.syncProvider ||
      state.syncInterval !== prev.syncInterval ||
      state.autoSync !== prev.autoSync

    if (syncSettingsChanged) {
      void applySyncConfig()
      setAutoSyncTimer()

      if (!state.syncEnabled && window.electronAPI?.syncStop) {
        void window.electronAPI.syncStop()
      }
    }
  })

  setAutoSyncTimer()

  if (store.syncEnabled) {
    void runSyncCycle()
  }
}