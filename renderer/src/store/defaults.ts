import {
  UserProfile,
  NotificationSettings,
  PrivacySettings,
  KeyboardShortcut,
  ReviewQuestion,
  CustomReviewQuestions
} from './types'

export const defaultUserProfile: UserProfile = {
  name: '',
  email: '',
  avatar: '',
  createdAt: new Date().toISOString(),
}

export const defaultNotificationSettings: NotificationSettings = {
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

export const defaultPrivacySettings: PrivacySettings = {
  dataCollection: false,
  analytics: false,
  crashReports: true,
  shareUsageData: false,
  localOnly: false,
}

export const defaultKeyboardShortcuts: KeyboardShortcut[] = [
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

export const defaultDailyQuestions: ReviewQuestion[] = [
  { id: 'daily-1', key: 'completedToday', question: 'What did I complete today?', placeholder: 'List your accomplishments, no matter how small...', enabled: true, isCustom: false, order: 0 },
  { id: 'daily-2', key: 'blockers', question: 'What blocked me or slowed me down?', placeholder: 'Identify obstacles, distractions, or challenges...', enabled: true, isCustom: false, order: 1 },
  { id: 'daily-3', key: 'habitsImpact', question: 'Did my habits support or hinder me?', placeholder: 'Reflect on how your daily habits affected your productivity...', enabled: true, isCustom: false, order: 2 },
  { id: 'daily-4', key: 'tomorrowFocus', question: 'What should I focus on tomorrow?', placeholder: 'Set your top 1-3 priorities for tomorrow...', enabled: true, isCustom: false, order: 3 },
  { id: 'daily-5', key: 'additionalNotes', question: 'Any additional thoughts?', placeholder: 'Free space for reflections, ideas, or gratitude...', enabled: true, isCustom: false, order: 4 },
]

export const defaultWeeklyQuestions: ReviewQuestion[] = [
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

export const defaultMonthlyQuestions: ReviewQuestion[] = [
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

export const defaultCustomReviewQuestions: CustomReviewQuestions = {
  daily: defaultDailyQuestions,
  weekly: defaultWeeklyQuestions,
  monthly: defaultMonthlyQuestions,
}
