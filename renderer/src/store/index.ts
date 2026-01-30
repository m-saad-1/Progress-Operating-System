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

interface Store {
  // Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void
  
  // User preferences
  timezone: string
  weekStart: 'sunday' | 'monday'
  language: string
  compactMode: boolean
  animationsEnabled: boolean
  soundEnabled: boolean
  
  // Data
  tasks: Task[]
  habits: Habit[]
  goals: Goal[]

  setInitialData: (data: { tasks: Task[]; habits: Habit[]; goals: Goal[] }) => void

  // Task Actions
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (taskId: string) => void

  // Habit Actions
  addHabit: (habit: Habit) => void
  updateHabit: (habit: Habit) => void
  deleteHabit: (habitId: string) => void

  // Goal Actions
  addGoal: (goal: Goal) => void
  updateGoal: (goal: Goal) => void
  deleteGoal: (goalId: string) => void

  // Notifications
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'read'>) => void
  markAsRead: (id: string) => void
  clearNotifications: () => void
  
  // Sync state
  syncEnabled: boolean
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
  updateLastSync: () => void
  updateSyncStatus: (status: 'idle' | 'syncing' | 'error') => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'light',
      toggleTheme: () => 
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      
      // User preferences
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStart: 'monday',
      language: 'en',
      compactMode: false,
      animationsEnabled: true,
      soundEnabled: true,
      
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

      // Habit Actions
      addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
      updateHabit: (habit) => set((state) => ({
        habits: state.habits.map((h) => (h.id === habit.id ? habit : h)),
      })),
      deleteHabit: (habitId) => set((state) => ({
        habits: state.habits.filter((h) => h.id !== habitId),
      })),

      // Goal Actions
      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
      updateGoal: (goal) => set((state) => ({
        goals: state.goals.map((g) => (g.id === goal.id ? goal : g)),
      })),
      deleteGoal: (goalId) => set((state) => ({
        goals: state.goals.filter((g) => g.id !== goalId),
      })),
      
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
      clearNotifications: () => set({ notifications: [] }),
      
      // Sync state
      syncEnabled: false,
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
      updateLastSync: () => set({ lastSync: new Date() }),
      updateSyncStatus: (status) => set({ syncStatus: status }),
    }),
    {
      name: 'progress-os-store',
      partialize: (state) => ({
        theme: state.theme,
        timezone: state.timezone,
        weekStart: state.weekStart,
        language: state.language,
        compactMode: state.compactMode,
        animationsEnabled: state.animationsEnabled,
        soundEnabled: state.soundEnabled,
        syncEnabled: state.syncEnabled,
      }),
    }
  )
)