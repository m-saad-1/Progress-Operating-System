import { useEffect, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useElectron } from './use-electron'
import { useToaster } from './use-toaster'
import { useStore } from '@/store'

interface KeyboardShortcut {
  keys: string
  description: string
  action: () => void
  category: 'navigation' | 'actions' | 'system' | 'productivity'
  enabled?: boolean
}

export const useKeyboardShortcuts = () => {
  const electron = useElectron()
  const { toast, success, info, error } = useToaster()
  const store = useStore()

  // Navigation shortcuts
  useHotkeys('ctrl+1', () => {
    window.location.href = '/'
  }, { preventDefault: true }, [])

  useHotkeys('ctrl+2', () => {
    window.location.href = '/goals'
  }, { preventDefault: true }, [])

  useHotkeys('ctrl+3', () => {
    window.location.href = '/tasks'
  }, { preventDefault: true }, [])

  useHotkeys('ctrl+4', () => {
    window.location.href = '/habits'
  }, { preventDefault: true }, [])

  useHotkeys('ctrl+5', () => {
    window.location.href = '/notes'
  }, { preventDefault: true }, [])

  useHotkeys('ctrl+6', () => {
    window.location.href = '/analytics'
  }, { preventDefault: true }, [])

  // Command palette
  useHotkeys('ctrl+k, cmd+k', (e) => {
    e.preventDefault()
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      metaKey: true,
    })
    document.dispatchEvent(event)
  }, { enableOnFormTags: true }, [])

  // Actions shortcuts
  useHotkeys('ctrl+n', () => {
    // Create new item based on current page
    const path = window.location.pathname
    if (path.includes('/tasks')) {
      // Open new task modal
      document.dispatchEvent(new CustomEvent('open-new-task'))
    } else if (path.includes('/goals')) {
      // Open new goal modal
      document.dispatchEvent(new CustomEvent('open-new-goal'))
    } else if (path.includes('/habits')) {
      // Open new habit modal
      document.dispatchEvent(new CustomEvent('open-new-habit'))
    }
  }, { preventDefault: true }, [])

  useHotkeys('ctrl+s', (event) => {
    event.preventDefault()
    success('Changes saved')
  }, { enableOnFormTags: true }, [success])

  useHotkeys('ctrl+z', async (event) => {
    event.preventDefault()
    if (electron.isReady) {
      const result = await electron.undo()
      if (result) {
        info('Undo successful')
      }
    }
  }, [electron, info])

  useHotkeys('ctrl+shift+z, ctrl+y', async (event) => {
    event.preventDefault()
    if (electron.isReady) {
      const result = await electron.redo()
      if (result) {
        info('Redo successful')
      }
    }
  }, [electron, info])

  useHotkeys('ctrl+f', (event) => {
    event.preventDefault()
    // Focus search input
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement
    if (searchInput) {
      searchInput.focus()
      searchInput.select()
    }
  }, [])

  // System shortcuts
  useHotkeys('ctrl+b', () => {
    store.toggleSidebar()
  }, [store])

  useHotkeys('ctrl+d', () => {
    store.toggleTheme()
    const theme = store.theme === 'dark' ? 'Light' : 'Dark'
    info(`Switched to ${theme} theme`)
  }, [store, info])

  useHotkeys('ctrl+shift+f', () => {
    store.toggleFocusMode()
    const mode = store.focusMode ? 'Focus mode enabled' : 'Focus mode disabled'
    info(mode)
  }, [store, info])

  // Productivity shortcuts
  useHotkeys('ctrl+shift+p', () => {
    // Start/stop Pomodoro timer
    document.dispatchEvent(new CustomEvent('toggle-pomodoro'))
  }, [])

  useHotkeys('ctrl+shift+t', () => {
    // Quick task entry
    document.dispatchEvent(new CustomEvent('quick-task-entry'))
  }, [])

  useHotkeys('ctrl+shift+j', () => {
    // Quick journal entry
    document.dispatchEvent(new CustomEvent('quick-journal-entry'))
  }, [])

  // Global shortcuts that work everywhere
  useHotkeys('esc', () => {
    // Close any open modals or popups
    document.dispatchEvent(new CustomEvent('close-modals'))
  }, [])

  useHotkeys('ctrl+shift+s', async (event) => {
    event.preventDefault()
    if (electron.isReady) {
      try {
        await electron.createBackup()
        success('Backup created successfully')
      } catch (err) {
        error('Failed to create backup')
      }
    }
  }, [electron, success, error])

  // Accessibility shortcuts
  useHotkeys('ctrl+plus', (event) => {
    event.preventDefault()
    document.documentElement.style.fontSize = 
      `${Math.min(parseFloat(getComputedStyle(document.documentElement).fontSize) + 1, 24)}px`
  }, [])

  useHotkeys('ctrl+minus', (event) => {
    event.preventDefault()
    document.documentElement.style.fontSize = 
      `${Math.max(parseFloat(getComputedStyle(document.documentElement).fontSize) - 1, 12)}px`
  }, [])

  useHotkeys('ctrl+0', (event) => {
    event.preventDefault()
    document.documentElement.style.fontSize = '16px'
  }, [])

  // Register shortcut help
  useEffect(() => {
    const handleHelpShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === '?') {
        event.preventDefault()
        document.dispatchEvent(new CustomEvent('show-shortcut-help'))
      }
    }

    document.addEventListener('keydown', handleHelpShortcut)
    return () => {
      document.removeEventListener('keydown', handleHelpShortcut)
    }
  }, [])

  const shortcuts: KeyboardShortcut[] = [
    // Navigation
    { keys: 'Ctrl + 1', description: 'Go to Dashboard', action: () => {}, category: 'navigation' },
    { keys: 'Ctrl + 2', description: 'Go to Goals', action: () => {}, category: 'navigation' },
    { keys: 'Ctrl + 3', description: 'Go to Tasks', action: () => {}, category: 'navigation' },
    { keys: 'Ctrl + 4', description: 'Go to Habits', action: () => {}, category: 'navigation' },
    { keys: 'Ctrl + 5', description: 'Go to Notes', action: () => {}, category: 'navigation' },
    { keys: 'Ctrl + 6', description: 'Go to Analytics', action: () => {}, category: 'navigation' },
    
    // Actions
    { keys: 'Ctrl + N', description: 'Create new item', action: () => {}, category: 'actions' },
    { keys: 'Ctrl + S', description: 'Save changes', action: () => {}, category: 'actions' },
    { keys: 'Ctrl + Z', description: 'Undo', action: () => {}, category: 'actions' },
    { keys: 'Ctrl + Shift + Z', description: 'Redo', action: () => {}, category: 'actions' },
    { keys: 'Ctrl + F', description: 'Focus search', action: () => {}, category: 'actions' },
    { keys: 'Ctrl + K', description: 'Open command palette', action: () => {}, category: 'actions' },
    
    // System
    { keys: 'Ctrl + B', description: 'Toggle sidebar', action: () => {}, category: 'system' },
    { keys: 'Ctrl + D', description: 'Toggle theme', action: () => {}, category: 'system' },
    { keys: 'Ctrl + Shift + F', description: 'Toggle focus mode', action: () => {}, category: 'system' },
    { keys: 'Ctrl + Shift + S', description: 'Create backup', action: () => {}, category: 'system' },
    
    // Productivity
    { keys: 'Ctrl + Shift + P', description: 'Toggle Pomodoro timer', action: () => {}, category: 'productivity' },
    { keys: 'Ctrl + Shift + T', description: 'Quick task entry', action: () => {}, category: 'productivity' },
    { keys: 'Ctrl + Shift + J', description: 'Quick journal entry', action: () => {}, category: 'productivity' },
    
    // Accessibility
    { keys: 'Ctrl + +', description: 'Increase font size', action: () => {}, category: 'system' },
    { keys: 'Ctrl + -', description: 'Decrease font size', action: () => {}, category: 'system' },
    { keys: 'Ctrl + 0', description: 'Reset font size', action: () => {}, category: 'system' },
    
    // Universal
    { keys: 'Esc', description: 'Close modals/popups', action: () => {}, category: 'system' },
    { keys: 'Ctrl + Shift + ?', description: 'Show all shortcuts', action: () => {}, category: 'system' },
  ]

  return {
    shortcuts,
    registerShortcut: (shortcut: KeyboardShortcut) => {
      // Add custom shortcut registration logic here
    },
    unregisterShortcut: (keys: string) => {
      // Add custom shortcut unregistration logic here
    },
  }
}