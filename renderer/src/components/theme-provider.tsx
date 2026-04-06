import React, { createContext, useContext, useEffect, useState } from 'react'
import { persistSettingsSnapshotToMainProcess } from '@/store'

type Theme = 'dark' | 'light' | 'system'

const SETTINGS_BACKUP_KEY = 'progress-os-settings-backup-v1'

const readThemeFallback = (storageKey: string, defaultTheme: Theme): Theme => {
  try {
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored
    }

    const rawBackup = localStorage.getItem(SETTINGS_BACKUP_KEY)
    if (!rawBackup) return defaultTheme

    const parsed = JSON.parse(rawBackup) as { theme?: 'dark' | 'light' }
    if (parsed.theme === 'dark' || parsed.theme === 'light') {
      return parsed.theme
    }
  } catch {
    // Ignore read failures and use default.
  }

  return defaultTheme
}

const writeThemeFallback = (storageKey: string, theme: Theme) => {
  try {
    localStorage.setItem(storageKey, theme)
  } catch {
    // Ignore write failures.
  }
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'progress-os-theme-v1', // Matched to your App.tsx key
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => readThemeFallback(storageKey, defaultTheme)
  )

  useEffect(() => {
    let cancelled = false

    const restoreThemeFromDesktopSnapshot = async () => {
      if (typeof window === 'undefined' || typeof window.electronAPI?.getSettingsSnapshot !== 'function') {
        return
      }

      try {
        const response = await window.electronAPI.getSettingsSnapshot()
        if (cancelled || !response || (typeof response === 'object' && 'success' in response && !response.success)) {
          return
        }

        const themePreference = response?.data?.themePreference
        if (themePreference === 'dark' || themePreference === 'light' || themePreference === 'system') {
          writeThemeFallback(storageKey, themePreference)
          setTheme(themePreference)
        }
      } catch {
        // Ignore restore failures.
      }
    }

    void restoreThemeFromDesktopSnapshot()

    return () => {
      cancelled = true
    }
  }, [storageKey])

  useEffect(() => {
    const root = window.document.documentElement

    // Remove existing classes to prevent "double classing"
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
      root.style.setProperty('color-scheme', systemTheme)
      return
    }

    root.classList.add(theme)
    root.style.setProperty('color-scheme', theme)
  }, [theme])

  useEffect(() => {
    void persistSettingsSnapshotToMainProcess({ themePreference: theme })
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      writeThemeFallback(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')
  return context
}