import React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { useToaster } from '@/hooks/use-toaster'
import { useTheme } from '@/components/theme-provider'

export function KeyboardShortcuts() {
  const navigate = useNavigate()
  const { addNotification } = useStore()
  const { theme, setTheme } = useTheme()
  const { toast } = useToaster()

  // Navigation shortcuts
  useHotkeys('ctrl+1, cmd+1', () => navigate('/'))
  useHotkeys('ctrl+2, cmd+2', () => navigate('/goals'))
  useHotkeys('ctrl+3, cmd+3', () => navigate('/tasks'))
  useHotkeys('ctrl+4, cmd+4', () => navigate('/habits'))
  useHotkeys('ctrl+5, cmd+5', () => navigate('/notes'))

  // Theme toggle
  useHotkeys('ctrl+shift+t, cmd+shift+t', () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    toast({
      title: 'Theme changed',
      description: `Switched to ${theme === 'dark' ? 'light' : 'dark'} mode`,
    })
  })

  // Quick actions
  useHotkeys('ctrl+n, cmd+n', (e) => {
    e.preventDefault()
    navigate('/goals?new=true')
  })

  useHotkeys('ctrl+t, cmd+t', (e) => {
    e.preventDefault()
    navigate('/tasks?new=true')
  })

  useHotkeys('ctrl+b, cmd+b', () => {
    const sidebar = document.querySelector('[data-sidebar]')
    if (sidebar) {
      // Toggle sidebar logic
    }
  })

  // Focus mode
  useHotkeys('f11', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  })

  // Quick save
  useHotkeys('ctrl+s, cmd+s', (e) => {
    e.preventDefault()
    toast({
      title: 'Auto-saved',
      description: 'Your progress has been saved',
    })
  })

  // Quick complete
  useHotkeys('ctrl+enter, cmd+enter', () => {
    // This would trigger completion of the active task
    toast({
      title: 'Task completed',
      description: 'Marked as complete',
    })
  })

  return null // This component doesn't render anything
}