import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  
  // Progress data
  dailyProgress: number
  weeklyConsistency: number
  monthlyGoals: number
  yearlyAchievements: number
  
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
  updateProgress: (daily: number, weekly: number) => void
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
      
      // Progress data
      dailyProgress: 65,
      weeklyConsistency: 82,
      monthlyGoals: 3,
      yearlyAchievements: 12,
      
      // Notifications
      notifications: [
        {
          id: '1',
          title: 'Backup Completed',
          message: 'Daily backup was completed successfully',
          type: 'success',
          time: '2 hours ago',
          read: false,
        },
        {
          id: '2',
          title: 'Goal Review Due',
          message: 'Weekly goal review is scheduled for today',
          type: 'warning',
          time: '5 hours ago',
          read: true,
        },
      ],
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
      
      updateProgress: (daily, weekly) => 
        set({ dailyProgress: daily, weeklyConsistency: weekly }),
      
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