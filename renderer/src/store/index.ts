import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ThemePreference, UserProfile } from './types'
import {
  SettingsBackup,
  normalizeUserProfile,
  readUserProfileBackup,
  writeUserProfileBackup,
  readStoredThemePreference,
  writeStoredThemePreference,
  normalizeSettingsBackup,
  getDefaultSettingsBackup,
  readSettingsBackup,
  writeSettingsBackup,
  selectSettingsBackup,
} from './storage'
import { defaultUserProfile, defaultNotificationSettings, defaultPrivacySettings, defaultCustomReviewQuestions, defaultKeyboardShortcuts } from './defaults'

import { DataSlice, createDataSlice } from './slices/dataSlice'
import { UISlice, createUISlice } from './slices/uiSlice'
import { TimerSlice, createTimerSlice } from './slices/timerSlice'
import { NotificationSlice, createNotificationSlice } from './slices/notificationSlice'
import { SettingsSlice, createSettingsSlice } from './slices/settingsSlice'
import { SyncSlice, createSyncSlice } from './slices/syncSlice'
export { 
  DEFAULT_POMODORO_DURATION_MS, 
  DEFAULT_SHORT_BREAK_DURATION_MS, 
  DEFAULT_LONG_BREAK_DURATION_MS, 
  DEFAULT_CUSTOM_DURATION_MS 
} from './slices/timerSlice'

import { DEFAULT_POMODORO_DURATION_MS, DEFAULT_CUSTOM_DURATION_MS } from './slices/timerSlice'

export interface Store extends DataSlice, UISlice, TimerSlice, NotificationSlice, SyncSlice, SettingsSlice {
  resetAllSettings: () => void
  resetAllData: () => void
}

const initialSettingsBackup = readSettingsBackup()

export const useStore = create<Store>()(
  persist(
    (set, get, api) => ({
      ...createDataSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createTimerSlice(set, get, api),
      ...createNotificationSlice(set, get, api),
      ...createSyncSlice(set, get, api),
      ...createSettingsSlice(set, get, api),

      // Set initial values from backup
      theme: initialSettingsBackup.theme,
      userProfile: readUserProfileBackup(),
      timezone: initialSettingsBackup.timezone,
      weekStart: initialSettingsBackup.weekStart,
      language: initialSettingsBackup.language,
      compactMode: initialSettingsBackup.compactMode,
      animationsEnabled: initialSettingsBackup.animationsEnabled,
      soundEnabled: initialSettingsBackup.soundEnabled,
      highContrastMode: initialSettingsBackup.highContrastMode,
      reduceMotion: initialSettingsBackup.reduceMotion,
      notificationSettings: initialSettingsBackup.notificationSettings,
      privacySettings: initialSettingsBackup.privacySettings,
      allowHistoryDeletion: initialSettingsBackup.allowHistoryDeletion,
      customReviewQuestions: initialSettingsBackup.customReviewQuestions,
      keyboardShortcuts: initialSettingsBackup.keyboardShortcuts,
      keyboardShortcutsEnabled: initialSettingsBackup.keyboardShortcutsEnabled,
      syncEnabled: initialSettingsBackup.syncEnabled,
      syncProvider: initialSettingsBackup.syncProvider,
      syncInterval: initialSettingsBackup.syncInterval,
      autoSync: initialSettingsBackup.autoSync,

      // Settings reset
      resetAllSettings: () => {
        writeUserProfileBackup(defaultUserProfile)
        writeSettingsBackup(getDefaultSettingsBackup())
        writeStoredThemePreference('light')
        set({
          theme: 'light',
          userProfile: defaultUserProfile,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          weekStart: 'monday',
          language: 'en',
          compactMode: false,
          animationsEnabled: true,
          soundEnabled: true,
          highContrastMode: false,
          reduceMotion: false,
          notificationSettings: defaultNotificationSettings,
          privacySettings: defaultPrivacySettings,
          allowHistoryDeletion: false,
          customReviewQuestions: defaultCustomReviewQuestions,
          keyboardShortcuts: defaultKeyboardShortcuts,
          keyboardShortcutsEnabled: true,
          syncEnabled: true,
          syncProvider: 'local',
          syncInterval: 5,
          autoSync: true,
        })
      },
      
      // Complete data reset - clears everything
      resetAllData: () => {
        writeUserProfileBackup(defaultUserProfile)
        writeSettingsBackup(getDefaultSettingsBackup())
        writeStoredThemePreference('light')
        set({
          // Reset theme and UI
          theme: 'light',
          sidebarOpen: true,
          commandPaletteOpen: false,
          focusMode: false,
          
          // Reset user profile
          userProfile: defaultUserProfile,
          
          // Reset preferences
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          weekStart: 'monday',
          language: 'en',
          compactMode: false,
          animationsEnabled: true,
          soundEnabled: true,
          highContrastMode: false,
          reduceMotion: false,
          
          // Reset notification settings
          notificationSettings: defaultNotificationSettings,
          
          // Reset privacy settings
          privacySettings: defaultPrivacySettings,

          // Reset data deletion safety
          allowHistoryDeletion: false,
          
          // Reset custom review questions
          customReviewQuestions: defaultCustomReviewQuestions,
          
          // Reset keyboard shortcuts
          keyboardShortcuts: defaultKeyboardShortcuts,
          keyboardShortcutsEnabled: true,
          
          // Reset timer
          timerMode: null,
          timerDurationMs: DEFAULT_POMODORO_DURATION_MS,
          timerElapsedMs: 0,
          timerStartedAt: null,
          timerRunning: false,
          customDurationMs: DEFAULT_CUSTOM_DURATION_MS,
          floatingTimerPosition: 'bottom-right',
          timerAlarmSound: 'classic',
          
          // Clear all data
          tasks: [],
          habits: [],
          goals: [],
          
          // Clear notifications
          notifications: [],
          
          // Reset sync state
          syncEnabled: true,
          syncProvider: 'local',
          syncInterval: 5,
          autoSync: true,
          lastSync: null,
          syncStatus: 'idle',
        })
      },
    }),
    {
      name: 'progress-os-store',
      partialize: (state) => ({
        theme: state.theme,
        userProfile: state.userProfile,
        timezone: state.timezone,
        weekStart: state.weekStart,
        language: state.language,
        compactMode: state.compactMode,
        animationsEnabled: state.animationsEnabled,
        soundEnabled: state.soundEnabled,
        highContrastMode: state.highContrastMode,
        reduceMotion: state.reduceMotion,
        notificationSettings: state.notificationSettings,
        privacySettings: state.privacySettings,
        allowHistoryDeletion: state.allowHistoryDeletion,
        customReviewQuestions: state.customReviewQuestions,
        keyboardShortcuts: state.keyboardShortcuts,
        keyboardShortcutsEnabled: state.keyboardShortcutsEnabled,
        syncEnabled: state.syncEnabled,
        syncProvider: state.syncProvider,
        syncInterval: state.syncInterval,
        autoSync: state.autoSync,
        lastSync: state.lastSync,
        syncStatus: state.syncStatus,
        timerMode: state.timerMode,
        timerDurationMs: state.timerDurationMs,
        timerElapsedMs: state.timerElapsedMs,
        timerStartedAt: state.timerStartedAt,
        timerRunning: state.timerRunning,
        customDurationMs: state.customDurationMs,
        floatingTimerPosition: state.floatingTimerPosition,
        timerAlarmSound: state.timerAlarmSound,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return

        const backup = readUserProfileBackup()
        const hasProfileData = Boolean(
          state.userProfile?.name || state.userProfile?.email || state.userProfile?.avatar
        )

        if (!hasProfileData && (backup.name || backup.email || backup.avatar)) {
          state.userProfile = backup
        }

        writeUserProfileBackup(state.userProfile)
        writeSettingsBackup(selectSettingsBackup(state))
      },
    }
  )
)

interface PersistentSettingsSnapshot {
  version: number
  settingsBackup: SettingsBackup
  userProfile: UserProfile
  themePreference: ThemePreference
}

interface SettingsSnapshotApi {
  getSettingsSnapshot: () => Promise<{ success: boolean; data?: unknown; error?: string }>
  saveSettingsSnapshot: (snapshot: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>
}

const getMainProcessSettingsApi = (): SettingsSnapshotApi | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const api = { invoke } as any;
  if (
    typeof api?.getSettingsSnapshot === 'function' &&
    typeof api?.saveSettingsSnapshot === 'function'
  ) {
    return api as SettingsSnapshotApi
  }

  return null
}

const hasMainProcessSettingsApi = () => getMainProcessSettingsApi() !== null

const buildPersistentSettingsSnapshot = (
  state: Store,
  themePreference: ThemePreference = readStoredThemePreference()
): PersistentSettingsSnapshot => ({
  version: 1,
  settingsBackup: selectSettingsBackup(state),
  userProfile: normalizeUserProfile(state.userProfile),
  themePreference,
})

let hasCompletedMainProcessSettingsHydration = !hasMainProcessSettingsApi()
let lastMainProcessSettingsSnapshotSerialized = ''

const applyPersistentSettingsSnapshot = (snapshot: Partial<PersistentSettingsSnapshot>) => {
  const normalizedSettings = normalizeSettingsBackup(snapshot.settingsBackup)
  const normalizedProfile = normalizeUserProfile(snapshot.userProfile)

  useStore.setState({
    theme: normalizedSettings.theme,
    userProfile: normalizedProfile,
    timezone: normalizedSettings.timezone,
    weekStart: normalizedSettings.weekStart,
    language: normalizedSettings.language,
    compactMode: normalizedSettings.compactMode,
    animationsEnabled: normalizedSettings.animationsEnabled,
    soundEnabled: normalizedSettings.soundEnabled,
    highContrastMode: normalizedSettings.highContrastMode,
    reduceMotion: normalizedSettings.reduceMotion,
    notificationSettings: normalizedSettings.notificationSettings,
    privacySettings: normalizedSettings.privacySettings,
    allowHistoryDeletion: normalizedSettings.allowHistoryDeletion,
    customReviewQuestions: normalizedSettings.customReviewQuestions,
    keyboardShortcuts: normalizedSettings.keyboardShortcuts,
    keyboardShortcutsEnabled: normalizedSettings.keyboardShortcutsEnabled,
    syncEnabled: normalizedSettings.syncEnabled,
    syncProvider: normalizedSettings.syncProvider,
    syncInterval: normalizedSettings.syncInterval,
    autoSync: normalizedSettings.autoSync,
  })

  writeUserProfileBackup(normalizedProfile)
  writeSettingsBackup(normalizedSettings)

  if (snapshot.themePreference === 'dark' || snapshot.themePreference === 'light' || snapshot.themePreference === 'system') {
    writeStoredThemePreference(snapshot.themePreference)
  }
}

export const persistSettingsSnapshotToMainProcess = async (
  options?: { themePreference?: ThemePreference; state?: Store }
) => {
  const mainProcessSettingsApi = getMainProcessSettingsApi()
  if (!hasCompletedMainProcessSettingsHydration || !mainProcessSettingsApi) {
    return
  }

  const state = options?.state ?? useStore.getState()
  const snapshot = buildPersistentSettingsSnapshot(
    state,
    options?.themePreference ?? readStoredThemePreference()
  )
  const serialized = JSON.stringify(snapshot)

  if (serialized === lastMainProcessSettingsSnapshotSerialized) {
    return
  }

  lastMainProcessSettingsSnapshotSerialized = serialized

  try {
    const response = await mainProcessSettingsApi.saveSettingsSnapshot(
      snapshot as unknown as Record<string, unknown>
    )
    if (response && typeof response === 'object' && 'success' in response && !response.success) {
      throw new Error(response.error || 'Failed to save settings snapshot')
    }
  } catch (error) {
    console.warn('Failed to persist settings snapshot to main process:', error)
  }
}

const hydrateSettingsFromMainProcess = async () => {
  const mainProcessSettingsApi = getMainProcessSettingsApi()
  if (!mainProcessSettingsApi) {
    hasCompletedMainProcessSettingsHydration = true
    return
  }

  try {
    const response = await mainProcessSettingsApi.getSettingsSnapshot()
    if (response && typeof response === 'object' && 'success' in response && !response.success) {
      throw new Error(response.error || 'Failed to load settings snapshot')
    }

    const snapshot = response?.data as Partial<PersistentSettingsSnapshot> | null | undefined
    if (snapshot?.settingsBackup || snapshot?.userProfile || snapshot?.themePreference) {
      applyPersistentSettingsSnapshot(snapshot)
      lastMainProcessSettingsSnapshotSerialized = JSON.stringify(
        buildPersistentSettingsSnapshot(
          useStore.getState(),
          snapshot.themePreference === 'dark' || snapshot.themePreference === 'light' || snapshot.themePreference === 'system'
            ? snapshot.themePreference
            : readStoredThemePreference()
        )
      )
    }
  } catch (error) {
    console.warn('Failed to hydrate settings from main process:', error)
  } finally {
    hasCompletedMainProcessSettingsHydration = true
    void persistSettingsSnapshotToMainProcess()
  }
}

if (typeof window !== 'undefined') {
  let lastSettingsMirrorSerialized = ''

  useStore.subscribe((state) => {
    const backup = selectSettingsBackup(state)
    const profile = normalizeUserProfile(state.userProfile)
    const serialized = JSON.stringify({
      backup,
      profile,
    })
    if (serialized === lastSettingsMirrorSerialized) {
      return
    }

    lastSettingsMirrorSerialized = serialized
    writeSettingsBackup(backup)
    writeUserProfileBackup(profile)
    void persistSettingsSnapshotToMainProcess({ state })
  })

  const flushPersistentSettings = () => {
    const state = useStore.getState()
    writeSettingsBackup(selectSettingsBackup(state))
    writeUserProfileBackup(normalizeUserProfile(state.userProfile))
    void persistSettingsSnapshotToMainProcess({ state })
  }

  flushPersistentSettings()
  window.addEventListener('beforeunload', flushPersistentSettings)
  void hydrateSettingsFromMainProcess()
}