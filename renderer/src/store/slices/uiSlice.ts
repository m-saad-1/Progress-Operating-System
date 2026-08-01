import { StateCreator } from 'zustand'
import { Store } from '../index'

export interface UISlice {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  focusMode: boolean

  toggleTheme: () => void
  toggleSidebar: () => void
  toggleCommandPalette: () => void
  toggleFocusMode: () => void
}

export const createUISlice: StateCreator<
  Store,
  [['zustand/persist', unknown]],
  [],
  UISlice
> = (set) => ({
  theme: 'light', // Initialized later
  sidebarOpen: true,
  commandPaletteOpen: false,
  focusMode: false,

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  toggleFocusMode: () =>
    set((state) => ({ focusMode: !state.focusMode })),
})
