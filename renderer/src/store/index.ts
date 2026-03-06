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
  taskReminderTime: string
  habitReminders: boolean
  habitReminderTime: string
  goalDeadlines: boolean
  goalDeadlineDaysAhead: number
  goalReminderTime: string
  reviewReminders: boolean
  reviewReminderTime: string
  dailySummary: boolean
  dailySummaryTime: string
  weeklyReport: boolean
  weeklyReportDay: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  weeklyReportTime: string
}

// Privacy Settings Interface
interface PrivacySettings {
  dataCollection: boolean
  analytics: boolean
  crashReports: boolean
  shareUsageData: boolean
  localOnly: boolean
}

// Review Question Interface
export interface ReviewQuestion {
  id: string
  key: string
  question: string
  placeholder: string
  enabled: boolean
  isCustom: boolean
  order: number
}

// Custom Review Questions by Type
export interface CustomReviewQuestions {
  daily: ReviewQuestion[]
  weekly: ReviewQuestion[]
  monthly: ReviewQuestion[]
}

// Keyboard Shortcut Interface
interface KeyboardShortcut {
  id: string
  action: string
  keys: string
  enabled: boolean
  category: 'navigation' | 'actions' | 'system' | 'productivity'
}

export type TimerMode = 'pomodoro' | 'shortBreak' | 'longBreak' | 'custom'
export type FloatingTimerPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type TimerAlarmSound =
  | 'classic'
  | 'digital'
  | 'bell'
  | 'chime'
  | 'soft'
  | 'focus'
  | 'crystal'
  | 'pulse'
  | 'gong'
  | 'beep'

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

  // Data deletion safety
  allowHistoryDeletion: boolean
  setAllowHistoryDeletion: (enabled: boolean) => void
  
  // Custom Review Questions
  customReviewQuestions: CustomReviewQuestions
  updateReviewQuestions: (type: 'daily' | 'weekly' | 'monthly', questions: ReviewQuestion[]) => void
  addReviewQuestion: (type: 'daily' | 'weekly' | 'monthly', question: Omit<ReviewQuestion, 'id' | 'order'>) => void
  removeReviewQuestion: (type: 'daily' | 'weekly' | 'monthly', questionId: string) => void
  toggleReviewQuestion: (type: 'daily' | 'weekly' | 'monthly', questionId: string) => void
  reorderReviewQuestions: (type: 'daily' | 'weekly' | 'monthly', startIndex: number, endIndex: number) => void
  resetReviewQuestions: (type: 'daily' | 'weekly' | 'monthly') => void
  
  // Keyboard Shortcuts
  keyboardShortcuts: KeyboardShortcut[]
  keyboardShortcutsEnabled: boolean
  setKeyboardShortcutsEnabled: (enabled: boolean) => void
  updateKeyboardShortcut: (id: string, keys: string) => void
  toggleKeyboardShortcut: (id: string) => void
  resetKeyboardShortcuts: () => void

  // Timer (shared across app)
  timerMode: TimerMode | null
  timerDurationMs: number
  timerElapsedMs: number
  timerStartedAt: number | null
  timerRunning: boolean
  customDurationMs: number
  floatingTimerPosition: FloatingTimerPosition
  timerAlarmSound: TimerAlarmSound

  startTimer: (mode: TimerMode, durationMs: number) => void
  stopTimer: () => void
  resetTimer: (durationMs?: number) => void
  setCustomDurationMs: (durationMs: number) => void
  setFloatingTimerPosition: (position: FloatingTimerPosition) => void
  setTimerAlarmSound: (sound: TimerAlarmSound) => void
  
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
  
  // Complete data reset
  resetAllData: () => void
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
  { id: 'nav-time', action: 'Go to Time', keys: 'Ctrl+8', enabled: true, category: 'navigation' },
  { id: 'nav-settings', action: 'Go to Settings', keys: 'Ctrl+9', enabled: true, category: 'navigation' },
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
  { id: 'prod-review', action: 'Start daily review', keys: 'Ctrl+Shift+I', enabled: true, category: 'productivity' },
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
  taskReminderTime: '09:00',
  habitReminders: true,
  habitReminderTime: '20:00',
  goalDeadlines: true,
  goalDeadlineDaysAhead: 3,
  goalReminderTime: '09:00',
  reviewReminders: true,
  reviewReminderTime: '19:00',
  dailySummary: false,
  dailySummaryTime: '21:00',
  weeklyReport: true,
  weeklyReportDay: 'sunday',
  weeklyReportTime: '20:00',
}

const defaultPrivacySettings: PrivacySettings = {
  dataCollection: false,
  analytics: false,
  crashReports: true,
  shareUsageData: false,
  localOnly: false,
}

// Default review questions for each type
const defaultDailyQuestions: ReviewQuestion[] = [
  { id: 'daily-1', key: 'completedToday', question: 'What did I complete today?', placeholder: 'List your accomplishments, no matter how small...', enabled: true, isCustom: false, order: 0 },
  { id: 'daily-2', key: 'blockers', question: 'What blocked me or slowed me down?', placeholder: 'Identify obstacles, distractions, or challenges...', enabled: true, isCustom: false, order: 1 },
  { id: 'daily-3', key: 'habitsImpact', question: 'Did my habits support or hinder me?', placeholder: 'Reflect on how your daily habits affected your productivity...', enabled: true, isCustom: false, order: 2 },
  { id: 'daily-4', key: 'tomorrowFocus', question: 'What should I focus on tomorrow?', placeholder: 'Set your top 1-3 priorities for tomorrow...', enabled: true, isCustom: false, order: 3 },
  { id: 'daily-5', key: 'additionalNotes', question: 'Any additional thoughts?', placeholder: 'Free space for reflections, ideas, or gratitude...', enabled: true, isCustom: false, order: 4 },
]

const defaultWeeklyQuestions: ReviewQuestion[] = [
  { id: 'weekly-1', key: 'tasksThatMattered', question: 'Which tasks actually mattered this week?', placeholder: 'Identify high-impact work that moved the needle...', enabled: true, isCustom: false, order: 0 },
  { id: 'weekly-2', key: 'tasksWasted', question: 'What tasks turned out to be low value?', placeholder: 'Recognize time spent on things that didn\'t matter...', enabled: true, isCustom: false, order: 1 },
  { id: 'weekly-3', key: 'habitsSlipped', question: 'Which habits slipped or broke consistency?', placeholder: 'Be honest about which habits you struggled with...', enabled: true, isCustom: false, order: 2 },
  { id: 'weekly-4', key: 'habitsMaintained', question: 'Which habits did you maintain well?', placeholder: 'Celebrate the habits you kept consistent...', enabled: true, isCustom: false, order: 3 },
  { id: 'weekly-5', key: 'stopDoing', question: 'What should I STOP doing?', placeholder: 'Identify behaviors, tasks, or habits to eliminate...', enabled: true, isCustom: false, order: 4 },
  { id: 'weekly-6', key: 'continueDoing', question: 'What should I CONTINUE doing?', placeholder: 'What\'s working well that you should keep doing...', enabled: true, isCustom: false, order: 5 },
  { id: 'weekly-7', key: 'adjustments', question: 'What should I START or ADJUST?', placeholder: 'New approaches or modifications to try...', enabled: true, isCustom: false, order: 6 },
  { id: 'weekly-8', key: 'weeklyWin', question: 'What was your biggest win this week?', placeholder: 'Celebrate your top achievement...', enabled: true, isCustom: false, order: 7 },
  { id: 'weekly-9', key: 'biggestChallenge', question: 'What was your biggest challenge?', placeholder: 'Acknowledge difficulties you faced...', enabled: true, isCustom: false, order: 8 },
  { id: 'weekly-10', key: 'nextWeekPriorities', question: 'What are the priorities for next week?', placeholder: 'Set your top 3-5 priorities...', enabled: true, isCustom: false, order: 9 },
]

const defaultMonthlyQuestions: ReviewQuestion[] = [
  { id: 'monthly-1', key: 'progressAssessment', question: 'How do you assess your overall progress this month?', placeholder: 'Provide an honest evaluation of your month...', enabled: true, isCustom: false, order: 0 },
  { id: 'monthly-2', key: 'highProgressReasons', question: 'If progress was high, why?', placeholder: 'Identify what contributed to your success...', enabled: true, isCustom: false, order: 1 },
  { id: 'monthly-3', key: 'lowProgressReasons', question: 'If progress was low, why?', placeholder: 'Understand what held you back...', enabled: true, isCustom: false, order: 2 },
  { id: 'monthly-4', key: 'goalsAlignment', question: 'Am I working on the right goals?', placeholder: 'Evaluate if your goals still align with your vision...', enabled: true, isCustom: false, order: 3 },
  { id: 'monthly-5', key: 'goalsToAdjust', question: 'Which goals need adjustment?', placeholder: 'Identify goals that need changes to timeline, scope, or approach...', enabled: true, isCustom: false, order: 4 },
  { id: 'monthly-6', key: 'goalsToAdd', question: 'What new goals should I consider?', placeholder: 'Think about areas you want to develop...', enabled: true, isCustom: false, order: 5 },
  { id: 'monthly-7', key: 'goalsToRemove', question: 'What goals should I drop or defer?', placeholder: 'Be honest about what\'s not serving you...', enabled: true, isCustom: false, order: 6 },
  { id: 'monthly-8', key: 'habitsIdentityAlignment', question: 'Are my habits aligned with who I want to become?', placeholder: 'Reflect on identity-level behavior change...', enabled: true, isCustom: false, order: 7 },
  { id: 'monthly-9', key: 'keyLearnings', question: 'What are the key learnings from this month?', placeholder: 'Capture insights that will help you grow...', enabled: true, isCustom: false, order: 8 },
  { id: 'monthly-10', key: 'nextMonthChanges', question: 'What must change next month?', placeholder: 'Identify critical changes to make...', enabled: true, isCustom: false, order: 9 },
  { id: 'monthly-11', key: 'nextMonthGoals', question: 'What are your top goals for next month?', placeholder: 'Set clear intentions for the coming month...', enabled: true, isCustom: false, order: 10 },
  { id: 'monthly-12', key: 'monthlyHighlight', question: 'What was the highlight of this month?', placeholder: 'Capture your best moment or achievement...', enabled: true, isCustom: false, order: 11 },
]

const defaultCustomReviewQuestions: CustomReviewQuestions = {
  daily: defaultDailyQuestions,
  weekly: defaultWeeklyQuestions,
  monthly: defaultMonthlyQuestions,
}

export const DEFAULT_POMODORO_DURATION_MS = 25 * 60 * 1000
export const DEFAULT_SHORT_BREAK_DURATION_MS = 5 * 60 * 1000
export const DEFAULT_LONG_BREAK_DURATION_MS = 15 * 60 * 1000
export const DEFAULT_CUSTOM_DURATION_MS = DEFAULT_POMODORO_DURATION_MS

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

      // Data deletion safety
      allowHistoryDeletion: false,
      setAllowHistoryDeletion: (allowHistoryDeletion) => set({ allowHistoryDeletion }),
      
      // Custom Review Questions
      customReviewQuestions: defaultCustomReviewQuestions,
      updateReviewQuestions: (type, questions) =>
        set((state) => ({
          customReviewQuestions: {
            ...state.customReviewQuestions,
            [type]: questions.map((q, i) => ({ ...q, order: i }))
          }
        })),
      addReviewQuestion: (type, question) =>
        set((state) => {
          const existingQuestions = state.customReviewQuestions[type]
          const newQuestion: ReviewQuestion = {
            ...question,
            id: `${type}-custom-${Date.now()}`,
            order: existingQuestions.length,
          }
          return {
            customReviewQuestions: {
              ...state.customReviewQuestions,
              [type]: [...existingQuestions, newQuestion]
            }
          }
        }),
      removeReviewQuestion: (type, questionId) =>
        set((state) => ({
          customReviewQuestions: {
            ...state.customReviewQuestions,
            [type]: state.customReviewQuestions[type]
              .filter(q => q.id !== questionId)
              .map((q, i) => ({ ...q, order: i }))
          }
        })),
      toggleReviewQuestion: (type, questionId) =>
        set((state) => ({
          customReviewQuestions: {
            ...state.customReviewQuestions,
            [type]: state.customReviewQuestions[type].map(q =>
              q.id === questionId ? { ...q, enabled: !q.enabled } : q
            )
          }
        })),
      reorderReviewQuestions: (type, startIndex, endIndex) =>
        set((state) => {
          const questions = [...state.customReviewQuestions[type]]
          const [removed] = questions.splice(startIndex, 1)
          questions.splice(endIndex, 0, removed)
          return {
            customReviewQuestions: {
              ...state.customReviewQuestions,
              [type]: questions.map((q, i) => ({ ...q, order: i }))
            }
          }
        }),
      resetReviewQuestions: (type) =>
        set((state) => ({
          customReviewQuestions: {
            ...state.customReviewQuestions,
            [type]: type === 'daily' ? defaultDailyQuestions 
                  : type === 'weekly' ? defaultWeeklyQuestions 
                  : defaultMonthlyQuestions
          }
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

      // Timer (shared across app)
      timerMode: null,
      timerDurationMs: DEFAULT_POMODORO_DURATION_MS,
      timerElapsedMs: 0,
      timerStartedAt: null,
      timerRunning: false,
      customDurationMs: DEFAULT_CUSTOM_DURATION_MS,
      floatingTimerPosition: 'bottom-right',
      timerAlarmSound: 'classic',

      startTimer: (mode, durationMs) =>
        set(() => ({
          timerMode: mode,
          timerDurationMs: durationMs,
          timerElapsedMs: 0,
          timerStartedAt: Date.now(),
          timerRunning: true,
        })),
      stopTimer: () =>
        set((state) => {
          if (!state.timerRunning) {
            return { timerRunning: false, timerStartedAt: null }
          }

          const elapsedSinceStart = state.timerStartedAt
            ? Date.now() - state.timerStartedAt
            : 0

          const updatedElapsed = Math.min(
            state.timerElapsedMs + elapsedSinceStart,
            state.timerDurationMs
          )

          return {
            timerRunning: false,
            timerStartedAt: null,
            timerElapsedMs: updatedElapsed,
          }
        }),
      resetTimer: (durationMs) =>
        set((state) => ({
          timerDurationMs: durationMs ?? state.timerDurationMs,
          timerElapsedMs: 0,
          timerStartedAt: null,
          timerRunning: false,
        })),
      setCustomDurationMs: (durationMs) =>
        set((state) => ({
          customDurationMs: durationMs,
          // Only update the scheduled duration when the custom timer is inactive
          ...(state.timerMode === 'custom' && !state.timerRunning
            ? { timerDurationMs: durationMs, timerElapsedMs: 0 }
            : {}),
        })),
      setFloatingTimerPosition: (position) => set({ floatingTimerPosition: position }),
      setTimerAlarmSound: (timerAlarmSound) => set({ timerAlarmSound }),
      
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
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, deleted_at: new Date().toISOString() }
            : t
        ),
      })),
      archiveTask: (taskId) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, deleted_at: new Date().toISOString() }
            : t
        ),
      })),
      restoreTask: (task) => set((state) => ({
        tasks: state.tasks.some((t) => t.id === task.id)
          ? state.tasks.map((t) => (t.id === task.id ? { ...task, deleted_at: null } : t))
          : [...state.tasks, { ...task, deleted_at: null }],
      })),

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
      syncEnabled: true,
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
        keyboardShortcuts: defaultKeyboardShortcuts,
        keyboardShortcutsEnabled: true,
        syncEnabled: true,
        syncProvider: 'local',
        syncInterval: 5,
        autoSync: true,
      }),
      
      // Complete data reset - clears everything
      resetAllData: () => set({
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
    }
  )
)