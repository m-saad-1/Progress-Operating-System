import { StateCreator } from 'zustand'
import { Store } from '../index'
import { Notification } from '../types'

export interface NotificationSlice {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotifications: () => void
}

export const createNotificationSlice: StateCreator<
  Store,
  [['zustand/persist', unknown]],
  [],
  NotificationSlice
> = (set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => {
      const nextNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        read: false,
      }

      const notifications = [nextNotification, ...state.notifications].sort((a, b) => {
        const aTs = Date.parse(a.time)
        const bTs = Date.parse(b.time)

        if (!Number.isNaN(aTs) && !Number.isNaN(bTs)) {
          return bTs - aTs
        }

        if (!Number.isNaN(aTs)) return -1
        if (!Number.isNaN(bTs)) return 1
        return b.id.localeCompare(a.id)
      })

      return { notifications }
    }),
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
})
