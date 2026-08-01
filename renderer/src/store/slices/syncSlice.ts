import { StateCreator } from 'zustand'
import { Store } from '../index'

export interface SyncSlice {
  syncEnabled: boolean
  syncProvider: 'local' | 'supabase' | 'custom'
  syncInterval: number // in minutes
  autoSync: boolean
  lastSync: Date | null
  syncStatus: 'idle' | 'syncing' | 'error'

  enableSync: (enabled: boolean) => void
  setSyncProvider: (provider: 'local' | 'supabase' | 'custom') => void
  setSyncInterval: (interval: number) => void
  setAutoSync: (autoSync: boolean) => void
  updateLastSync: () => void
  updateSyncStatus: (status: 'idle' | 'syncing' | 'error') => void
}

export const createSyncSlice: StateCreator<
  Store,
  [['zustand/persist', unknown]],
  [],
  SyncSlice
> = (set) => ({
  syncEnabled: true, // Initialized from backup later
  syncProvider: 'local',
  syncInterval: 5,
  autoSync: true,
  lastSync: null,
  syncStatus: 'idle',

  enableSync: (enabled) => set({ syncEnabled: enabled }),
  setSyncProvider: (provider) => set({ syncProvider: provider }),
  setSyncInterval: (interval) => set({ syncInterval: interval }),
  setAutoSync: (autoSync) => set({ autoSync: autoSync }),
  updateLastSync: () => set({ lastSync: new Date() }),
  updateSyncStatus: (status) => set({ syncStatus: status }),
})
