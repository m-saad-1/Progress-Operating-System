import { useEffect, useMemo, useRef } from 'react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '@/store'
import { useElectron } from '@/hooks/use-electron'
import { useTheme } from '@/components/theme-provider'
import { useToaster } from '@/hooks/use-toaster'
import { database } from '@/lib/database'

const EMAIL_QUEUE_KEY = 'progress-os-email-queue'
const REMINDER_LOG_KEY = 'progress-os-reminder-log'

type ReminderScope = 'daily' | 'weekly' | 'monthly'

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

const toKeyToken = (value: string): string => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'escape' || normalized === 'esc') return 'esc'
  if (normalized === ' ') return 'space'
  if (normalized === 'arrowup') return 'up'
  if (normalized === 'arrowdown') return 'down'
  if (normalized === 'arrowleft') return 'left'
  if (normalized === 'arrowright') return 'right'
  return normalized
}

const parseShortcut = (shortcut: string) => {
  const tokens = shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

  const ctrl = tokens.includes('ctrl') || tokens.includes('control')
  const shift = tokens.includes('shift')
  const alt = tokens.includes('alt') || tokens.includes('option')
  const meta = tokens.includes('cmd') || tokens.includes('meta') || tokens.includes('command')
  const key = tokens.find(
    (token) => !['ctrl', 'control', 'shift', 'alt', 'option', 'cmd', 'meta', 'command'].includes(token)
  )

  return {
    ctrl,
    shift,
    alt,
    meta,
    key: key ? toKeyToken(key) : '',
  }
}

const normalizeEventKey = (event: KeyboardEvent): string => {
  if (event.key === ' ') return 'space'
  return toKeyToken(event.key)
}

const getReminderLog = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(REMINDER_LOG_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const setReminderLog = (value: Record<string, string>) => {
  localStorage.setItem(REMINDER_LOG_KEY, JSON.stringify(value))
}

const parseTimeToMinute = (value: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const hh = Number(match[1])
  const mm = Number(match[2])
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null
  }

  return hh * 60 + mm
}

const getScopeKey = (date: Date, scope: ReminderScope): string => {
  if (scope === 'weekly') {
    return format(date, "RRRR-'W'II")
  }

  if (scope === 'monthly') {
    return format(date, 'yyyy-MM')
  }

  return format(date, 'yyyy-MM-dd')
}

const shouldFireReminder = (id: string, scopeKey: string) => {
  const log = getReminderLog()
  if (log[id] === scopeKey) return false
  log[id] = scopeKey
  setReminderLog(log)
  return true
}

const isReminderDueNow = (
  reminderId: string,
  targetTime: string,
  now: Date,
  scope: ReminderScope = 'daily'
) => {
  const targetMinute = parseTimeToMinute(targetTime)
  if (targetMinute === null) return false

  const nowMinute = now.getHours() * 60 + now.getMinutes()
  if (nowMinute < targetMinute) return false

  return shouldFireReminder(reminderId, getScopeKey(now, scope))
}

const queueEmailNotification = (title: string, message: string) => {
  try {
    const raw = localStorage.getItem(EMAIL_QUEUE_KEY)
    const queue = raw ? JSON.parse(raw) : []
    queue.unshift({
      id: `${Date.now()}`,
      title,
      message,
      timestamp: new Date().toISOString(),
    })
    localStorage.setItem(EMAIL_QUEUE_KEY, JSON.stringify(queue.slice(0, 500)))
  } catch {
    // ignore queue failures
  }
}

export function useAppRuntime() {
  const navigate = useNavigate()
  const location = useLocation()
  const store = useStore()
  const electron = useElectron()
  const { theme, setTheme } = useTheme()
  const { info, warning, error } = useToaster()

  const shortcuts = useMemo(
    () => store.keyboardShortcuts.filter((shortcut) => shortcut.enabled),
    [store.keyboardShortcuts]
  )

  const syncTimerRef = useRef<number | null>(null)

  // Helper function for web notification fallback
  const tryWebNotification = async (title: string, message: string) => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window)
    ) {
      return
    }

    if (Notification.permission === 'granted') {
      try {
        // Try to get the icon path for web notification
        let iconPath: string | undefined
        if (window.electronAPI?.getIconPath) {
          iconPath = await window.electronAPI.getIconPath()
        }

        const notificationOptions: NotificationOptions = {
          body: message,
          ...(iconPath && { icon: iconPath })
        }
        new Notification(title, notificationOptions)
      } catch (error) {
        console.warn('Failed to create web notification:', error)
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const sendReminder = (
    title: string,
    message: string,
    type: 'info' | 'warning' = 'info'
  ) => {
    store.addNotification({
      title,
      message,
      type,
      time: new Date().toISOString(),
    })

    if (type === 'warning') {
      warning(title, message)
    } else {
      info(title, message)
    }

    if (store.notificationSettings.email) {
      queueEmailNotification(title, message)
    }

    if (
      store.notificationSettings.enabled &&
      store.notificationSettings.desktop
    ) {
      // Use native Electron notification for better icon support across platforms
      if (window.electronAPI?.showNotification) {
        window.electronAPI.showNotification({ title, body: message })
          .catch((error: unknown) => {
            console.warn('Failed to show native notification:', error)
            // Fallback to web notification
            tryWebNotification(title, message)
          })
      } else {
        // Fallback to web notification if Electron API is not available
        tryWebNotification(title, message)
      }
    }

    if (store.notificationSettings.sound) {
      try {
        const ctx = new AudioContext()
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = 880
        gain.gain.value = 0.05
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start()
        oscillator.stop(ctx.currentTime + 0.12)
      } catch {
        // ignore audio failures
      }
    }
  }

  const performGlobalSync = async () => {
    if (!store.syncEnabled) return

    try {
      store.updateSyncStatus('syncing')

      const [notes, reviews, timeBlocks] = await Promise.all([
        database.getNotes().catch(() => []),
        database.getReviews(undefined, 1000).catch(() => []),
        database.getTimeBlocks().catch(() => []),
      ])

      localStorage.setItem(
        'progress-os-sync-snapshot',
        JSON.stringify({
          syncedAt: new Date().toISOString(),
          provider: store.syncProvider,
          userProfile: store.userProfile,
          tasks: store.tasks,
          habits: store.habits,
          goals: store.goals,
          notes,
          reviews,
          timeBlocks,
          settings: {
            timezone: store.timezone,
            weekStart: store.weekStart,
            language: store.language,
            highContrastMode: store.highContrastMode,
            notificationSettings: store.notificationSettings,
            privacySettings: store.privacySettings,
            keyboardShortcutsEnabled: store.keyboardShortcutsEnabled,
            keyboardShortcuts: store.keyboardShortcuts,
          },
        })
      )

      if (electron.isReady && store.syncProvider !== 'local') {
        if (window.electronAPI?.invoke) {
          await window.electronAPI.invoke('sync:setConfig', {
            enabled: true,
            provider: store.syncProvider,
            syncInterval: store.syncInterval,
          })
        }

        const syncResult: any = await electron.syncStart()
        if (syncResult && typeof syncResult === 'object' && 'success' in syncResult && !syncResult.success) {
          throw new Error(syncResult.error || 'Sync failed')
        }
      }

      store.updateLastSync()
      store.updateSyncStatus('idle')
    } catch (syncError) {
      console.error('Global sync failed:', syncError)
      store.updateSyncStatus('error')
      error('Sync failed', syncError instanceof Error ? syncError.message : 'Unknown sync error')
    }
  }

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('high-contrast-mode', store.highContrastMode)
    root.setAttribute('data-high-contrast', store.highContrastMode ? 'true' : 'false')
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  }, [store.highContrastMode, theme])

  useEffect(() => {
    if (!store.privacySettings.localOnly) return

    if (store.syncEnabled) {
      store.enableSync(false)
    }
  }, [store.privacySettings.localOnly, store.syncEnabled])

  useEffect(() => {
    if (store.privacySettings.analytics || store.privacySettings.dataCollection || store.privacySettings.shareUsageData) {
      return
    }

    const privacyQueueKeys = [
      EMAIL_QUEUE_KEY,
      'progress-os-analytics-queue',
      'progress-os-analytics-buffer',
      'progress-os-telemetry-queue',
    ]

    privacyQueueKeys.forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch {
        // ignore storage failures
      }
    })
  }, [store.privacySettings.analytics, store.privacySettings.dataCollection, store.privacySettings.shareUsageData])

  useEffect(() => {
    if (!store.notificationSettings.enabled) return

    const timer = window.setInterval(async () => {
      const now = new Date()
      const dateKey = format(now, 'yyyy-MM-dd')

      if (
        store.notificationSettings.taskReminders &&
        isReminderDueNow('tasks-daily-reminder', store.notificationSettings.taskReminderTime, now, 'daily')
      ) {
        const dueToday = store.tasks.filter(
          (task) => !task.deleted_at && task.status !== 'completed' && task.due_date?.startsWith(dateKey)
        )

        if (dueToday.length > 0) {
          sendReminder(
            'Task reminder',
            `${dueToday.length} task${dueToday.length > 1 ? 's are' : ' is'} due today.`,
            'warning'
          )
        }
      }

      if (
        store.notificationSettings.habitReminders &&
        isReminderDueNow('habits-daily-reminder', store.notificationSettings.habitReminderTime, now, 'daily')
      ) {
        const activeHabits = store.habits.filter((habit) => !habit.deleted_at)
        if (activeHabits.length > 0) {
          sendReminder(
            'Habit reminder',
            `You have ${activeHabits.length} habit${activeHabits.length > 1 ? 's' : ''} to check in today.`
          )
        }
      }

      if (
        store.notificationSettings.goalDeadlines &&
        isReminderDueNow('goals-daily-reminder', store.notificationSettings.goalReminderTime, now, 'daily')
      ) {
        const goalsAtRisk = store.goals.filter((goal) => {
          if (goal.deleted_at || goal.status === 'completed' || !goal.target_date) return false
          const due = new Date(goal.target_date)
          const diffMs = due.getTime() - now.getTime()
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
          return diffDays >= 0 && diffDays <= store.notificationSettings.goalDeadlineDaysAhead
        })

        if (goalsAtRisk.length > 0) {
          sendReminder(
            'Goal deadline reminder',
            `${goalsAtRisk.length} goal${goalsAtRisk.length > 1 ? 's are' : ' is'} approaching deadline.`,
            'warning'
          )
        }
      }

      if (
        store.notificationSettings.reviewReminders &&
        isReminderDueNow('reviews-daily-reminder', store.notificationSettings.reviewReminderTime, now, 'daily')
      ) {
        const dayStart = format(now, 'yyyy-MM-dd')
        const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
        const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

        const [dailyReview, weeklyReview, monthlyReview] = await Promise.all([
          database.getReviewForPeriod('daily', dayStart, dayStart),
          database.getReviewForPeriod('weekly', weekStart, weekEnd),
          database.getReviewForPeriod('monthly', monthStart, monthEnd),
        ])

        const pendingTypes = [
          !dailyReview ? 'daily' : null,
          now.getDay() === 0 && !weeklyReview ? 'weekly' : null,
          null,
        ].filter(Boolean)

        if (pendingTypes.length > 0) {
          sendReminder(
            'Review reminder',
            `Pending review${pendingTypes.length > 1 ? 's' : ''}: ${pendingTypes.join(', ')}.`
          )
        }

        const monthLastDay = endOfMonth(now).getDate()
        const daysUntilMonthEnd = monthLastDay - now.getDate()

        // Weekly review reminder: Sunday only
        if (now.getDay() === 0 && !weeklyReview) {
          if (isReminderDueNow('weekly-review-sunday-reminder', store.notificationSettings.reviewReminderTime, now, 'daily')) {
            sendReminder(
              'Weekly Review Due Today',
              'Sunday weekly review is ready. Complete it to close your week clearly.',
              'warning'
            )
          }
        }

        // Monthly review reminders: two days prior, one day prior, and hard due on last day.
        if (!monthlyReview) {
          if (
            daysUntilMonthEnd === 2 &&
            isReminderDueNow('monthly-review-two-days-prior', store.notificationSettings.reviewReminderTime, now, 'daily')
          ) {
            sendReminder(
              'Monthly Review Coming Up',
              'Your monthly review is due in 2 days. Plan time to complete it.',
              'warning'
            )
          }

          if (
            daysUntilMonthEnd === 1 &&
            isReminderDueNow('monthly-review-one-day-prior', store.notificationSettings.reviewReminderTime, now, 'daily')
          ) {
            sendReminder(
              'Monthly Review Tomorrow',
              'Your monthly review is due tomorrow. Prepare your highlights and blockers.',
              'warning'
            )
          }

          if (
            daysUntilMonthEnd === 0 &&
            isReminderDueNow('monthly-review-hard-due', store.notificationSettings.reviewReminderTime, now, 'daily')
          ) {
            sendReminder(
              'Monthly Review Required Today',
              'Today is the last day of the month. Complete your monthly review now.',
              'warning'
            )
          }
        }
      }

      if (
        store.notificationSettings.dailySummary &&
        isReminderDueNow('daily-summary-reminder', store.notificationSettings.dailySummaryTime, now, 'daily')
      ) {
        const completedTasks = store.tasks.filter((task) => !task.deleted_at && task.status === 'completed').length
        const activeHabits = store.habits.filter((habit) => !habit.deleted_at).length
        sendReminder(
          'Daily summary',
          `Completed tasks: ${completedTasks}. Active habits: ${activeHabits}.`
        )
      }

      const weekdayName = now
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toLowerCase() as
        | 'sunday'
        | 'monday'
        | 'tuesday'
        | 'wednesday'
        | 'thursday'
        | 'friday'
        | 'saturday'

      if (
        store.notificationSettings.weeklyReport &&
        weekdayName === store.notificationSettings.weeklyReportDay &&
        isReminderDueNow('weekly-report-reminder', store.notificationSettings.weeklyReportTime, now, 'weekly')
      ) {
        const completedTasks = store.tasks.filter((task) => !task.deleted_at && task.status === 'completed').length
        const totalTasks = store.tasks.filter((task) => !task.deleted_at).length
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        sendReminder(
          'Weekly report',
          `Task completion this week: ${completionRate}% (${completedTasks}/${totalTasks}).`
        )
      }
    }, 30000)

    return () => window.clearInterval(timer)
  }, [store, store.notificationSettings])

  useEffect(() => {
    if (!store.syncEnabled) {
      if (syncTimerRef.current) {
        window.clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }

      if (electron.isReady) {
        electron.syncStop().catch(() => {
          // ignore stop errors
        })
      }

      store.updateSyncStatus('idle')
      return
    }

    performGlobalSync()

    if (store.autoSync && store.syncInterval > 0) {
      syncTimerRef.current = window.setInterval(() => {
        performGlobalSync()
      }, store.syncInterval * 60 * 1000)
    }

    return () => {
      if (syncTimerRef.current) {
        window.clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }, [store.syncEnabled, store.autoSync, store.syncInterval, store.syncProvider, electron.isReady])

  useEffect(() => {
    if (!electron.isReady) return

    if (window.electronAPI?.invoke) {
      window.electronAPI.invoke('sync:setConfig', {
        enabled: store.syncEnabled,
        provider: store.syncProvider,
        syncInterval: store.syncInterval,
      }).catch(() => {
        // ignore config sync errors
      })
    }

    const cleanup = electron.onSyncUpdate((status: any) => {
      if (status?.status === 'syncing') {
        store.updateSyncStatus('syncing')
        return
      }

      if (status?.status === 'error') {
        store.updateSyncStatus('error')
        return
      }

      if (status?.lastSync || status?.status === 'success') {
        store.updateLastSync()
      }

      store.updateSyncStatus('idle')
    })

    return cleanup
  }, [electron, store.syncEnabled, store.syncProvider, store.syncInterval])

  useEffect(() => {
    const handleSidebarToggle = () => {
      window.dispatchEvent(new CustomEvent('app:toggle-sidebar'))
    }

    const actions: Record<string, () => void | Promise<void>> = {
      'nav-dashboard': () => navigate('/'),
      'nav-goals': () => navigate('/goals'),
      'nav-tasks': () => navigate('/tasks'),
      'nav-habits': () => navigate('/habits'),
      'nav-notes': () => navigate('/notes'),
      'nav-reviews': () => navigate('/reviews'),
      'nav-analytics': () => navigate('/analytics'),
      'nav-time': () => navigate('/time'),
      'nav-settings': () => navigate('/settings'),
      'action-new': () => {
        if (location.pathname.includes('/tasks')) {
          window.dispatchEvent(new CustomEvent('app:new-task'))
        } else if (location.pathname.includes('/goals')) {
          window.dispatchEvent(new CustomEvent('app:new-goal'))
        } else if (location.pathname.includes('/habits')) {
          window.dispatchEvent(new CustomEvent('app:new-habit'))
        } else if (location.pathname.includes('/notes')) {
          window.dispatchEvent(new CustomEvent('app:new-note'))
        } else if (location.pathname.includes('/reviews')) {
          window.dispatchEvent(new CustomEvent('app:start-review'))
        } else {
          navigate('/tasks')
          window.dispatchEvent(new CustomEvent('app:new-task'))
        }
      },
      'action-save': () => {
        info('Changes saved')
      },
      'action-undo': async () => {
        if (!electron.isReady) return
        await electron.undo()
      },
      'action-redo': async () => {
        if (!electron.isReady) return
        await electron.redo()
      },
      'action-search': () => {
        const input = document.querySelector(
          'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
        ) as HTMLInputElement | null
        if (input) {
          input.focus()
          input.select()
        }
      },
      'action-palette': () => store.toggleCommandPalette(),
      'sys-sidebar': handleSidebarToggle,
      'sys-theme': () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      'sys-focus': () => store.toggleFocusMode(),
      'sys-backup': async () => {
        if (!electron.isReady) return
        await electron.createBackup()
        info('Backup created')
      },
      'prod-pomodoro': () => navigate('/time'),
      'prod-quick-task': () => {
        navigate('/tasks')
        window.dispatchEvent(new CustomEvent('app:new-task'))
      },
      'prod-journal': () => {
        navigate('/notes')
        window.dispatchEvent(new CustomEvent('app:new-note'))
      },
      'prod-review': () => {
        navigate('/reviews')
        window.dispatchEvent(new CustomEvent('app:start-review'))
      },
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!store.keyboardShortcutsEnabled) return

      const eventKey = normalizeEventKey(event)
      const blockedByInput = isEditableTarget(event.target)

      for (const shortcut of shortcuts) {
        const parsed = parseShortcut(shortcut.keys)
        if (!parsed.key) continue

        const matches =
          parsed.key === eventKey &&
          parsed.ctrl === event.ctrlKey &&
          parsed.shift === event.shiftKey &&
          parsed.alt === event.altKey &&
          parsed.meta === event.metaKey

        if (!matches) continue

        if (blockedByInput && !['action-save', 'action-search', 'action-palette'].includes(shortcut.id)) {
          return
        }

        event.preventDefault()
        const action = actions[shortcut.id]
        if (action) {
          void action()
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    shortcuts,
    store.keyboardShortcutsEnabled,
    store.toggleCommandPalette,
    store.toggleFocusMode,
    location.pathname,
    navigate,
    electron,
    info,
    theme,
    setTheme,
  ])
}
