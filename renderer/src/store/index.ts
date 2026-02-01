import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Task, Habit, Goal } from '../../../../shared/types'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  read: boolean
}

// User Profile Interface
interface UserProfile {
  name: string
  email: string
  avatar?: string
  createdAt: string
}

// Notification Settings Interface
interface NotificationSettings {
  enabled: boolean
  sound: boolean
  desktop: boolean
  email: boolean
  taskReminders: boolean
  habitReminders: boolean
  goalDeadlines: boolean
  dailySummary: boolean
  weeklyReport: boolean
}

// Privacy Settings Interface
interface PrivacySettings {
  dataCollection: boolean
  analytics: boolean
  crashReports: boolean
  shareUsageData: boolean
  localOnly: boolean
}

// Keyboard Shortcut Interface
interface KeyboardShortcut {
  id: string
  action: string
  keys: string
  enabled: boolean
  category: 'navigation' | 'actions' | 'system' | 'productivity'
}

interface Store {
  // Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void
  
  // User Profile
  userProfile: UserProfile
  updateUserProfile: (profile: Partial<UserProfile>) => void
  
  // User preferences
  timezone: string
  weekStart: 'sunday' | 'monday'
  language: string
  compactMode: boolean
  animationsEnabled: boolean
  soundEnabled: boolean
  highContrastMode: boolean
  reduceMotion: boolean
  
  // Preference setters
  setTimezone: (timezone: string) => void
  setWeekStart: (weekStart: 'sunday' | 'monday') => void
  setLanguage: (language: string) => void
  setCompactMode: (compactMode: boolean) => void
  setAnimationsEnabled: (enabled: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setHighContrastMode: (enabled: boolean) => void
  setReduceMotion: (enabled: boolean) => void
  
  // Notification Settings
  notificationSettings: NotificationSettings
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void
  
  // Privacy Settings
  privacySettings: PrivacySettings
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void
  
  // Keyboard Shortcuts
  keyboardShortcuts: KeyboardShortcut[]
  keyboardShortcutsEnabled: boolean
  setKeyboardShortcutsEnabled: (enabled: boolean) => void
  updateKeyboardShortcut: (id: string, keys: string) => void
  toggleKeyboardShortcut: (id: string) => void
  resetKeyboardShortcuts: () => void
  
  // Data
  tasks: Task[]
  habits: Habit[]
  goals: Goal[]

  setInitialData: (data: { tasks: Task[]; habits: Habit[]; goals: Goal[] }) => void

  // Task Actions
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (taskId: string) => void
  archiveTask: (taskId: string) => void
  restoreTask: (task: Task) => void

  // Habit Actions
  addHabit: (habit: Habit) => void
  updateHabit: (habit: Habit) => void
  deleteHabit: (habitId: string) => void
  archiveHabit: (habitId: string) => void
  restoreHabit: (habit: Habit) => void

  // Goal Actions
  addGoal: (goal: Goal) => void
  updateGoal: (goal: Goal) => void
  deleteGoal: (goalId: string) => void
  archiveGoal: (goalId: string) => void
  restoreGoal: (goal: Goal) => void

  // Notifications
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotifications: () => void
  
  // Sync state
  syncEnabled: boolean
  syncProvider: 'local' | 'supabase' | 'custom'
  syncInterval: number // in minutes
  autoSync: boolean
  lastSync: Date | null
  syncStatus: 'idle' | 'syncing' | 'error'
  
  // UI state
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  focusMode: boolean
  
  // Actions
  toggleSidebar: () => void
  toggleCommandPalette: () => void
  toggleFocusMode: () => void
  enableSync: (enabled: boolean) => void
  setSyncProvider: (provider: 'local' | 'supabase' | 'custom') => void
  setSyncInterval: (interval: number) => void
  setAutoSync: (autoSync: boolean) => void
  updateLastSync: () => void
  updateSyncStatus: (status: 'idle' | 'syncing' | 'error') => void
  
  // Settings reset
  resetAllSettings: () => void
}

// Default keyboard shortcuts
const defaultKeyboardShortcuts: KeyboardShortcut[] = [
  { id: 'nav-dashboard', action: 'Go to Dashboard', keys: 'Ctrl+1', enabled: true, category: 'navigation' },
  { id: 'nav-goals', action: 'Go to Goals', keys: 'Ctrl+2', enabled: true, category: 'navigation' },
  { id: 'nav-tasks', action: 'Go to Tasks', keys: 'Ctrl+3', enabled: true, category: 'navigation' },
  { id: 'nav-habits', action: 'Go to Habits', keys: 'Ctrl+4', enabled: true, category: 'navigation' },
  { id: 'nav-notes', action: 'Go to Notes', keys: 'Ctrl+5', enabled: true, category: 'navigation' },
  { id: 'nav-reviews', action: 'Go to Reviews', keys: 'Ctrl+6', enabled: true, category: 'navigation' },
  { id: 'nav-analytics', action: 'Go to Analytics', keys: 'Ctrl+7', enabled: true, category: 'navigation' },
  { id: 'action-new', action: 'Create new item', keys: 'Ctrl+N', enabled: true, category: 'actions' },
  { id: 'action-save', action: 'Save changes', keys: 'Ctrl+S', enabled: true, category: 'actions' },
  { id: 'action-undo', action: 'Undo', keys: 'Ctrl+Z', enabled: true, category: 'actions' },
  { id: 'action-redo', action: 'Redo', keys: 'Ctrl+Shift+Z', enabled: true, category: 'actions' },
  { id: 'action-search', action: 'Focus search', keys: 'Ctrl+F', enabled: true, category: 'actions' },
  { id: 'action-palette', action: 'Open command palette', keys: 'Ctrl+K', enabled: true, category: 'actions' },
  { id: 'sys-sidebar', action: 'Toggle sidebar', keys: 'Ctrl+B', enabled: true, category: 'system' },
  { id: 'sys-theme', action: 'Toggle theme', keys: 'Ctrl+D', enabled: true, category: 'system' },
  { id: 'sys-focus', action: 'Toggle focus mode', keys: 'Ctrl+Shift+F', enabled: true, category: 'system' },
  { id: 'sys-backup', action: 'Create backup', keys: 'Ctrl+Shift+S', enabled: true, category: 'system' },
  { id: 'prod-pomodoro', action: 'Toggle Pomodoro timer', keys: 'Ctrl+Shift+P', enabled: true, category: 'productivity' },
  { id: 'prod-quick-task', action: 'Quick task entry', keys: 'Ctrl+Shift+T', enabled: true, category: 'productivity' },
  { id: 'prod-journal', action: 'Quick journal entry', keys: 'Ctrl+Shift+J', enabled: true, category: 'productivity' },
  { id: 'prod-review', action: 'Start daily review', keys: 'Ctrl+Shift+R', enabled: true, category: 'productivity' },
]

const defaultUserProfile: UserProfile = {
  name: '',
  email: '',
  avatar: '',
  createdAt: new Date().toISOString(),
}

const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  sound: true,
  desktop: true,
  email: false,
  taskReminders: true,
  habitReminders: true,
  goalDeadlines: true,
  dailySummary: false,
  weeklyReport: true,
}

const defaultPrivacySettings: PrivacySettings = {
  dataCollection: false,
  analytics: false,
  crashReports: true,
  shareUsageData: false,
  localOnly: true,
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'light',
      toggleTheme: () => 
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      
      // User Profile
      userProfile: defaultUserProfile,
      updateUserProfile: (profile) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...profile }
        })),
      
      // User preferences
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStart: 'monday',
      language: 'en',
      compactMode: false,
      animationsEnabled: true,
      soundEnabled: true,
      highContrastMode: false,
      reduceMotion: false,
      
      // Preference setters
      setTimezone: (timezone) => set({ timezone }),
      setWeekStart: (weekStart) => set({ weekStart }),
      setLanguage: (language) => set({ language }),
      setCompactMode: (compactMode) => set({ compactMode }),
      setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHighContrastMode: (highContrastMode) => set({ highContrastMode }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      
      // Notification Settings
      notificationSettings: defaultNotificationSettings,
      updateNotificationSettings: (settings) =>
        set((state) => ({
          notificationSettings: { ...state.notificationSettings, ...settings }
        })),
      
      // Privacy Settings
      privacySettings: defaultPrivacySettings,
      updatePrivacySettings: (settings) =>
        set((state) => ({
          privacySettings: { ...state.privacySettings, ...settings }
        })),
      
      // Keyboard Shortcuts
      keyboardShortcuts: defaultKeyboardShortcuts,
      keyboardShortcutsEnabled: true,
      setKeyboardShortcutsEnabled: (enabled) => set({ keyboardShortcutsEnabled: enabled }),
      updateKeyboardShortcut: (id, keys) =>
        set((state) => ({
          keyboardShortcuts: state.keyboardShortcuts.map(s =>
            s.id === id ? { ...s, keys } : s
          )
        })),
      toggleKeyboardShortcut: (id) =>
        set((state) => ({
          keyboardShortcuts: state.keyboardShortcuts.map(s =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
          )
        })),
      resetKeyboardShortcuts: () => set({ keyboardShortcuts: defaultKeyboardShortcuts }),
      
      // Data
      tasks: [],
      habits: [],
      goals: [],

      setInitialData: (data) => set(data),

      // Task Actions
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (task) => set((state) => ({
        tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
      })),
      deleteTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
      })),
      archiveTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
      })),
      restoreTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),

      // Habit Actions
      addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
      updateHabit: (habit) => set((state) => ({
        habits: state.habits.map((h) => (h.id === habit.id ? habit : h)),
      })),
      deleteHabit: (habitId) => set((state) => ({
        habits: state.habits.filter((h) => h.id !== habitId),
      })),
      archiveHabit: (habitId) => set((state) => ({
        habits: state.habits.filter((h) => h.id !== habitId),
      })),
      restoreHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),

      // Goal Actions
      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      updateGoal: (goal) => set((state) => ({
        goals: state.goals.map((g) => (g.id === goal.id ? goal : g)),
      })),
      deleteGoal: (goalId) => set((state) => ({
        goals: state.goals.filter((g) => g.id !== goalId),
      })),
      archiveGoal: (goalId) => set((state) => ({
        goals: state.goals.filter((g) => g.id !== goalId),
      })),
      restoreGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      
      // Notifications
      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: Date.now().toString(),
              read: false,
            },
            ...state.notifications,
          ],
        })),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearNotifications: () => set({ notifications: [] }),
      
      // Sync state
      syncEnabled: false,
      syncProvider: 'local',
      syncInterval: 5,
      autoSync: true,
      lastSync: null,
      syncStatus: 'idle',
      
      // UI state
      sidebarOpen: true,
      commandPaletteOpen: false,
      focusMode: false,
      
      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleCommandPalette: () => 
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      
      enableSync: (enabled) => set({ syncEnabled: enabled }),
      setSyncProvider: (provider) => set({ syncProvider: provider }),
      setSyncInterval: (interval) => set({ syncInterval: interval }),
      setAutoSync: (autoSync) => set({ autoSync: autoSync }),
      updateLastSync: () => set({ lastSync: new Date() }),
      updateSyncStatus: (status) => set({ syncStatus: status }),
      
      // Settings reset
      resetAllSettings: () => set({
        theme: 'light',
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
        keyboardShortcuts: defaultKeyboardShortcuts,
        keyboardShortcutsEnabled: true,
        syncEnabled: false,
        syncProvider: 'local',
        syncInterval: 5,
        autoSync: true,
      }),
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
        keyboardShortcuts: state.keyboardShortcuts,
        keyboardShortcutsEnabled: state.keyboardShortcutsEnabled,
        syncEnabled: state.syncEnabled,
        syncProvider: state.syncProvider,
        syncInterval: state.syncInterval,
        autoSync: state.autoSync,
      }),
    }
  )
)