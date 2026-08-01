import { UserProfile, ThemePreference, NotificationSettings, PrivacySettings, CustomReviewQuestions, KeyboardShortcut } from './types'
import {
  defaultUserProfile,
  defaultNotificationSettings,
  defaultPrivacySettings,
  defaultCustomReviewQuestions,
  defaultKeyboardShortcuts,
} from './defaults'

export const USER_PROFILE_BACKUP_KEY = 'progress-os-user-profile-v1'
export const SETTINGS_BACKUP_KEY = 'progress-os-settings-backup-v1'
export const THEME_PREFERENCE_KEY = 'progress-os-theme-v1'

export interface SettingsBackup {
  theme: 'light' | 'dark'
  timezone: string
  weekStart: 'sunday' | 'monday'
  language: string
  compactMode: boolean
  animationsEnabled: boolean
  soundEnabled: boolean
  highContrastMode: boolean
  reduceMotion: boolean
  notificationSettings: NotificationSettings
  privacySettings: PrivacySettings
  allowHistoryDeletion: boolean
  customReviewQuestions: CustomReviewQuestions
  keyboardShortcuts: KeyboardShortcut[]
  keyboardShortcutsEnabled: boolean
  syncEnabled: boolean
  syncProvider: 'local' | 'supabase' | 'custom'
  syncInterval: number
  autoSync: boolean
}

export const normalizeUserProfile = (incoming?: Partial<UserProfile>): UserProfile => ({
  name: typeof incoming?.name === 'string' ? incoming.name : defaultUserProfile.name,
  email: typeof incoming?.email === 'string' ? incoming.email : defaultUserProfile.email,
  avatar: typeof incoming?.avatar === 'string' ? incoming.avatar : undefined,
  createdAt:
    typeof incoming?.createdAt === 'string' ? incoming.createdAt : defaultUserProfile.createdAt,
})

export const readUserProfileBackup = (): UserProfile => {
  if (typeof window === 'undefined') {
    return defaultUserProfile
  }

  try {
    const raw = window.localStorage.getItem(USER_PROFILE_BACKUP_KEY)
    if (!raw) return defaultUserProfile

    const parsed = JSON.parse(raw) as Partial<UserProfile>
    return normalizeUserProfile(parsed)
  } catch {
    return defaultUserProfile
  }
}

export const writeUserProfileBackup = (profile: UserProfile) => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(USER_PROFILE_BACKUP_KEY, JSON.stringify(profile))
  } catch {
    // Ignore backup write failures.
  }
}

export const readStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  try {
    const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored
    }

    const rawBackup = window.localStorage.getItem(SETTINGS_BACKUP_KEY)
    if (!rawBackup) return 'light'

    const parsed = JSON.parse(rawBackup) as { theme?: 'light' | 'dark' }
    return parsed.theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const writeStoredThemePreference = (themePreference: ThemePreference) => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(THEME_PREFERENCE_KEY, themePreference)
  } catch {
    // Ignore write failures.
  }
}

export const getDefaultSettingsBackup = (): SettingsBackup => ({
  theme: 'light',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekStart: 'monday',
  language: 'en',
  compactMode: false,
  animationsEnabled: true,
  soundEnabled: true,
  highContrastMode: false,
  reduceMotion: false,
  notificationSettings: { ...defaultNotificationSettings },
  privacySettings: { ...defaultPrivacySettings },
  allowHistoryDeletion: false,
  customReviewQuestions: { ...defaultCustomReviewQuestions },
  keyboardShortcuts: [...defaultKeyboardShortcuts],
  keyboardShortcutsEnabled: true,
  syncEnabled: true,
  syncProvider: 'local',
  syncInterval: 5,
  autoSync: true,
})

export const normalizeSettingsBackup = (incoming?: Partial<SettingsBackup>): SettingsBackup => {
  const defaults = getDefaultSettingsBackup()
  return {
    theme: incoming?.theme === 'dark' ? 'dark' : 'light',
    timezone: typeof incoming?.timezone === 'string' ? incoming.timezone : defaults.timezone,
    weekStart: incoming?.weekStart === 'sunday' ? 'sunday' : 'monday',
    language: typeof incoming?.language === 'string' ? incoming.language : defaults.language,
    compactMode: typeof incoming?.compactMode === 'boolean' ? incoming.compactMode : defaults.compactMode,
    animationsEnabled: typeof incoming?.animationsEnabled === 'boolean' ? incoming.animationsEnabled : defaults.animationsEnabled,
    soundEnabled: typeof incoming?.soundEnabled === 'boolean' ? incoming.soundEnabled : defaults.soundEnabled,
    highContrastMode: typeof incoming?.highContrastMode === 'boolean' ? incoming.highContrastMode : defaults.highContrastMode,
    reduceMotion: typeof incoming?.reduceMotion === 'boolean' ? incoming.reduceMotion : defaults.reduceMotion,
    notificationSettings: {
      ...defaults.notificationSettings,
      ...(incoming?.notificationSettings || {}),
    },
    privacySettings: {
      ...defaults.privacySettings,
      ...(incoming?.privacySettings || {}),
    },
    allowHistoryDeletion:
      typeof incoming?.allowHistoryDeletion === 'boolean'
        ? incoming.allowHistoryDeletion
        : defaults.allowHistoryDeletion,
    customReviewQuestions: {
      ...defaults.customReviewQuestions,
      ...(incoming?.customReviewQuestions || {}),
    },
    keyboardShortcuts:
      Array.isArray(incoming?.keyboardShortcuts) && incoming.keyboardShortcuts.length > 0
        ? incoming.keyboardShortcuts
        : defaults.keyboardShortcuts,
    keyboardShortcutsEnabled:
      typeof incoming?.keyboardShortcutsEnabled === 'boolean'
        ? incoming.keyboardShortcutsEnabled
        : defaults.keyboardShortcutsEnabled,
    syncEnabled: typeof incoming?.syncEnabled === 'boolean' ? incoming.syncEnabled : defaults.syncEnabled,
    syncProvider:
      incoming?.syncProvider === 'supabase' || incoming?.syncProvider === 'custom'
        ? incoming.syncProvider
        : 'local',
    syncInterval:
      typeof incoming?.syncInterval === 'number' && Number.isFinite(incoming.syncInterval)
        ? incoming.syncInterval
        : defaults.syncInterval,
    autoSync: typeof incoming?.autoSync === 'boolean' ? incoming.autoSync : defaults.autoSync,
  }
}

export const readSettingsBackup = (): SettingsBackup => {
  if (typeof window === 'undefined') {
    return getDefaultSettingsBackup()
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_BACKUP_KEY)
    if (!raw) return getDefaultSettingsBackup()
    return normalizeSettingsBackup(JSON.parse(raw) as Partial<SettingsBackup>)
  } catch {
    return getDefaultSettingsBackup()
  }
}

export const writeSettingsBackup = (backup: SettingsBackup) => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(SETTINGS_BACKUP_KEY, JSON.stringify(backup))
  } catch {
    // Ignore backup write failures.
  }
}

export const selectSettingsBackup = (state: any): SettingsBackup =>
  normalizeSettingsBackup({
    theme: state.theme,
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
  })
