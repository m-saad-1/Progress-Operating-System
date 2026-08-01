import { StateCreator } from 'zustand'
import { Store } from '../index'
import { UserProfile, NotificationSettings, PrivacySettings, CustomReviewQuestions, KeyboardShortcut, ReviewQuestion } from '../types'
import { defaultKeyboardShortcuts, defaultDailyQuestions, defaultWeeklyQuestions, defaultMonthlyQuestions } from '../defaults'
import { writeUserProfileBackup } from '../storage'

export interface SettingsSlice {
  userProfile: UserProfile
  updateUserProfile: (profile: Partial<UserProfile>) => void

  timezone: string
  weekStart: 'sunday' | 'monday'
  language: string
  compactMode: boolean
  animationsEnabled: boolean
  soundEnabled: boolean
  highContrastMode: boolean
  reduceMotion: boolean
  
  setTimezone: (timezone: string) => void
  setWeekStart: (weekStart: 'sunday' | 'monday') => void
  setLanguage: (language: string) => void
  setCompactMode: (compactMode: boolean) => void
  setAnimationsEnabled: (enabled: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
  setHighContrastMode: (enabled: boolean) => void
  setReduceMotion: (enabled: boolean) => void
  
  notificationSettings: NotificationSettings
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void
  
  privacySettings: PrivacySettings
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void

  allowHistoryDeletion: boolean
  setAllowHistoryDeletion: (enabled: boolean) => void
  
  customReviewQuestions: CustomReviewQuestions
  updateReviewQuestions: (type: 'daily' | 'weekly' | 'monthly', questions: ReviewQuestion[]) => void
  addReviewQuestion: (type: 'daily' | 'weekly' | 'monthly', question: Omit<ReviewQuestion, 'id' | 'order'>) => void
  removeReviewQuestion: (type: 'daily' | 'weekly' | 'monthly', questionId: string) => void
  toggleReviewQuestion: (type: 'daily' | 'weekly' | 'monthly', questionId: string) => void
  reorderReviewQuestions: (type: 'daily' | 'weekly' | 'monthly', startIndex: number, endIndex: number) => void
  resetReviewQuestions: (type: 'daily' | 'weekly' | 'monthly') => void
  
  keyboardShortcuts: KeyboardShortcut[]
  keyboardShortcutsEnabled: boolean
  setKeyboardShortcutsEnabled: (enabled: boolean) => void
  updateKeyboardShortcut: (id: string, keys: string) => void
  toggleKeyboardShortcut: (id: string) => void
  resetKeyboardShortcuts: () => void
  
  resetAllSettings: () => void
}

export const createSettingsSlice: StateCreator<
  Store,
  [['zustand/persist', unknown]],
  [],
  SettingsSlice
> = (set) => ({
  // These will be overridden by initialSettingsBackup during store creation
  userProfile: null as any,
  timezone: '',
  weekStart: 'monday',
  language: 'en',
  compactMode: false,
  animationsEnabled: true,
  soundEnabled: true,
  highContrastMode: false,
  reduceMotion: false,
  notificationSettings: null as any,
  privacySettings: null as any,
  allowHistoryDeletion: false,
  customReviewQuestions: null as any,
  keyboardShortcuts: [],
  keyboardShortcutsEnabled: true,

  updateUserProfile: (profile) =>
    set((state) => {
      const nextProfile = { ...state.userProfile, ...profile }
      writeUserProfileBackup(nextProfile)
      return { userProfile: nextProfile }
    }),

  setTimezone: (timezone) => set({ timezone }),
  setWeekStart: (weekStart) => set({ weekStart }),
  setLanguage: (language) => set({ language }),
  setCompactMode: (compactMode) => set({ compactMode }),
  setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setHighContrastMode: (highContrastMode) => set({ highContrastMode }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  
  updateNotificationSettings: (settings) =>
    set((state) => ({
      notificationSettings: { ...state.notificationSettings, ...settings }
    })),
  
  updatePrivacySettings: (settings) =>
    set((state) => ({
      privacySettings: { ...state.privacySettings, ...settings }
    })),

  setAllowHistoryDeletion: (allowHistoryDeletion) => set({ allowHistoryDeletion }),
  
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

  resetAllSettings: () => {
    // We will hook this up in store/index.ts since it crosses slice boundaries
  }
})
