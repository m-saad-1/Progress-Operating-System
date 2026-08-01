

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  time: string
  read: boolean
  isOverdue?: boolean
}

export interface UserProfile {
  name: string
  email: string
  avatar?: string
  createdAt: string
}

export interface NotificationSettings {
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

export interface PrivacySettings {
  dataCollection: boolean
  analytics: boolean
  crashReports: boolean
  shareUsageData: boolean
  localOnly: boolean
}

export interface ReviewQuestion {
  id: string
  key: string
  question: string
  placeholder: string
  enabled: boolean
  isCustom: boolean
  order: number
}

export interface CustomReviewQuestions {
  daily: ReviewQuestion[]
  weekly: ReviewQuestion[]
  monthly: ReviewQuestion[]
}

export interface KeyboardShortcut {
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
