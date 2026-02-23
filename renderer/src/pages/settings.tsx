import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  Save, 
  User, 
  Bell, 
  Globe, 
  Palette,
  Database,
  Cloud,
  Shield,
  Keyboard,
  Eye,
  Volume2,
  Upload,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Lock,
  Trash2,
  Settings2,
  Mail,
  Calendar,
  Clock,
  Languages,
  Monitor,
  Sparkles,
  Zap,
  BellRing,
  HardDrive,
  MessageSquare,
    Paperclip,
    Loader2
} from 'lucide-react'
import { useStore } from '@/store'
import { useToaster } from '@/hooks/use-toaster'
import { useElectron } from '@/hooks/use-electron'
import { useTheme } from '@/components/theme-provider'
import { useBackup } from '@/hooks/use-backup'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { getFeedbackRuntimeMetadata, queueFeedbackForRetry, retryQueuedFeedback, submitFeedback } from '@/lib/feedback-service'

// Setting Item Component for consistent styling
interface SettingItemProps {
  icon?: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

const SettingItem = ({ icon, title, description, children, className }: SettingItemProps) => (
  <div className={cn("flex items-center justify-between py-4", className)}>
    <div className="flex items-start gap-3">
      {icon && (
        <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-sm font-medium">{title}</Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

// Keyboard Shortcut Editor Component
interface ShortcutEditorProps {
  shortcut: {
    id: string
    action: string
    keys: string
    enabled: boolean
    category: string
  }
  onUpdate: (id: string, keys: string) => void
  onToggle: (id: string) => void
}

const ShortcutEditor = ({ shortcut, onUpdate, onToggle }: ShortcutEditorProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [newKeys, setNewKeys] = useState(shortcut.keys)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    const keys: string[] = []
    if (e.ctrlKey) keys.push('Ctrl')
    if (e.shiftKey) keys.push('Shift')
    if (e.altKey) keys.push('Alt')
    if (e.metaKey) keys.push('Cmd')
    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
      keys.push(e.key.toUpperCase())
    }
    if (keys.length > 1) {
      setNewKeys(keys.join('+'))
    }
  }

  const handleSave = () => {
    onUpdate(shortcut.id, newKeys)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setNewKeys(shortcut.keys)
    setIsEditing(false)
  }

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg transition-all",
      shortcut.enabled ? "bg-card hover:bg-accent/50" : "bg-muted/30 opacity-60"
    )}>
      <div className="flex items-center gap-3">
        <Switch 
          checked={shortcut.enabled}
          onCheckedChange={() => onToggle(shortcut.id)}
        />
        <span className={cn(
          "text-sm",
          !shortcut.enabled && "line-through text-muted-foreground"
        )}>
          {shortcut.action}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Input
              value={newKeys}
              onKeyDown={handleKeyDown}
              onChange={() => {}}
              placeholder="Press keys..."
              className="w-32 h-8 text-xs font-mono text-center"
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={handleSave}>
              <Check className="h-4 w-4 text-green-500" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => shortcut.enabled && setIsEditing(true)}
            disabled={!shortcut.enabled}
            className="h-8 px-3 font-mono text-xs bg-secondary/50 border-transparent hover:bg-secondary dark:bg-secondary/30 dark:hover:bg-secondary/50"
          >
            {shortcut.keys}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const store = useStore()
  const { success, info, error } = useToaster()
  const electron = useElectron()
  const { theme, setTheme } = useTheme()
  const backup = useBackup()
  
  // Zustand selectors for proper subscription
  const syncEnabled = useStore(state => state.syncEnabled)
  const enableSync = useStore(state => state.enableSync)
  const syncProvider = useStore(state => state.syncProvider)
  const setSyncProvider = useStore(state => state.setSyncProvider)
  const syncInterval = useStore(state => state.syncInterval)
  const setSyncInterval = useStore(state => state.setSyncInterval)
  const autoSync = useStore(state => state.autoSync)
  const setAutoSync = useStore(state => state.setAutoSync)
  
  // Local form state - initialized from store
  const [profileName, setProfileName] = useState(store.userProfile?.name || '')
  const [profileEmail, setProfileEmail] = useState(store.userProfile?.email || '')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const settingsTabs = useMemo(
    () => new Set(['profile', 'appearance', 'notifications', 'sync', 'privacy', 'keyboard']),
    []
  )
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab')
    return tabParam && settingsTabs.has(tabParam) ? tabParam : 'profile'
  })
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [isClearingCaches, setIsClearingCaches] = useState(false)
  const [feedbackType, setFeedbackType] = useState<'bug-report' | 'suggestion' | 'feature-request' | 'general-feedback'>('general-feedback')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackEmail, setFeedbackEmail] = useState(store.userProfile?.email || '')
  const [feedbackEmailTouched, setFeedbackEmailTouched] = useState(false)
  const [feedbackScreenshotName, setFeedbackScreenshotName] = useState('')
  const [feedbackScreenshotDataUrl, setFeedbackScreenshotDataUrl] = useState('')
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [hasRetriedQueuedFeedback, setHasRetriedQueuedFeedback] = useState(false)
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [feedbackSubmitStatus, setFeedbackSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Sync local state with store changes
  useEffect(() => {
    setProfileName(store.userProfile?.name || '')
    setProfileEmail(store.userProfile?.email || '')
    if (!feedbackEmailTouched) {
      setFeedbackEmail(store.userProfile?.email || '')
    }
  }, [store.userProfile, feedbackEmailTouched])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Sync activeTab to URL when user changes it (one-way: state → URL only)
  useEffect(() => {
    const current = searchParams.get('tab') || 'profile'
    if (current === activeTab) return

    const next = new URLSearchParams(searchParams)
    if (activeTab === 'profile') {
      next.delete('tab')
    } else {
      next.set('tab', activeTab)
    }
    setSearchParams(next, { replace: true })
  }, [activeTab, setSearchParams])

  // Track unsaved changes
  useEffect(() => {
    if (!store.userProfile) return
    
    const hasChanges = 
      profileName !== (store.userProfile.name || '') ||
      profileEmail !== (store.userProfile.email || '')
    setHasUnsavedChanges(hasChanges)
  }, [profileName, profileEmail, store.userProfile])

  // Save profile changes
  const handleSaveProfile = () => {
    store.updateUserProfile({
      name: profileName,
      email: profileEmail,
    })
    setHasUnsavedChanges(false)
    success('Profile updated successfully')
  }

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
      store.resetAllSettings()
      setProfileName('')
      setProfileEmail('')
      success('Settings reset to default')
    }
  }

  const handleResetAllData = async () => {
    try {
      info('Resetting all application data...')
      
      // Reset Zustand store first
      store.resetAllData()
      
      // Clear localStorage
      localStorage.clear()

      // Clear sessionStorage
      try {
        sessionStorage.clear()
      } catch {
        // ignore
      }

      // Clear CacheStorage (if available)
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
      } catch {
        // ignore
      }

      // Clear IndexedDB (best-effort)
      try {
        const anyIndexedDb = indexedDB as any
        if (anyIndexedDb?.databases) {
          const dbs = await anyIndexedDb.databases()
          await Promise.all(
            (dbs || [])
              .map((d: any) => d?.name)
              .filter(Boolean)
              .map((name: string) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(name)
                  req.onsuccess = () => resolve()
                  req.onerror = () => resolve()
                  req.onblocked = () => resolve()
                })
              )
          )
        }
      } catch {
        // ignore
      }
      
      // Call the electron API to reset database and restart

      await electron.resetAllData()
      
      // The app will relaunch automatically from the main process
    } catch (err) {
      console.error('Failed to reset all data:', err)
      error('Failed to reset application data. Please try again.')
    }
  }

  const handleClearPrivacyCaches = async () => {
    const confirmed = window.confirm(
      'Clear local notification history, reminder logs, and sync cache snapshots? This does not delete tasks, habits, goals, notes, or reviews.'
    )

    if (!confirmed) return

    setIsClearingCaches(true)

    try {
      info('Clearing caches...')
      
      // localStorage keys to clear
      const localStorageKeys = [
        'progress-os-reminder-log',
        'progress-os-email-queue',
        'progress-os-sync-snapshot',
        'progress-os-analytics-queue',
        'progress-os-analytics-buffer',
        'progress-os-telemetry-queue',
        'progress-os-cache',
      ]

      // Clear localStorage
      localStorageKeys.forEach((key) => {
        try {
          localStorage.removeItem(key)
        } catch {
          // ignore storage failures
        }
      })

      // Clear sessionStorage
      try {
        const sessionStorageKeys = Array.from(sessionStorage).map(([key]) => key)
        sessionStorageKeys.forEach((key) => {
          if (key.includes('cache') || key.includes('reminder') || key.includes('sync') || key.includes('queue')) {
            sessionStorage.removeItem(key)
          }
        })
      } catch {
        // ignore session storage failures
      }

      // Clear in-app notifications
      store.clearNotifications()

      // Clear CacheStorage API (if available)
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
        }
      } catch {
        // ignore cache storage failures
      }

      success('Local privacy caches cleared successfully')
    } catch (err) {
      console.error('Error clearing privacy caches:', err)
      error('Failed to clear privacy caches. Please try again.')
    } finally {
      setIsClearingCaches(false)
    }
  }

  const handleShortcutUpdate = (id: string, keys: string) => {
    const normalizedKeys = keys.trim()
    if (!normalizedKeys) {
      error('Shortcut cannot be empty')
      return
    }

    const conflict = store.keyboardShortcuts.find(
      (shortcut) => shortcut.id !== id && shortcut.enabled && shortcut.keys.toLowerCase() === normalizedKeys.toLowerCase()
    )

    if (conflict) {
      error(`Shortcut conflict with "${conflict.action}"`)
      return
    }

    store.updateKeyboardShortcut(id, normalizedKeys)
    success('Shortcut updated')
  }

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleFeedbackScreenshotChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setFeedbackScreenshotName('')
      setFeedbackScreenshotDataUrl('')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      error('Screenshot must be 2MB or smaller')
      event.target.value = ''
      return
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Failed to read screenshot file'))
        reader.readAsDataURL(file)
      })

      setFeedbackScreenshotName(file.name)
      setFeedbackScreenshotDataUrl(dataUrl)
    } catch {
      error('Failed to process screenshot file')
    }
  }

  const handleSubmitFeedback = async () => {
    setFeedbackSubmitStatus(null)

    if (!isOnline) {
      error('No internet connection. Please reconnect and try again.')
      setFeedbackSubmitStatus({ type: 'error', message: 'No internet connection. Please reconnect and try again.' })
      return
    }

    if (!feedbackMessage.trim()) {
      error('Message is required')
      setFeedbackSubmitStatus({ type: 'error', message: 'Message is required.' })
      return
    }

    if (feedbackEmail.trim() && !isValidEmail(feedbackEmail.trim())) {
      error('Please enter a valid email address')
      setFeedbackSubmitStatus({ type: 'error', message: 'Please enter a valid email address.' })
      return
    }

    setIsSubmittingFeedback(true)

    try {
      const metadata = await getFeedbackRuntimeMetadata(`${window.location.pathname} (settings-tab:${activeTab})`)

      const result = await submitFeedback({
        feedbackType,
        message: feedbackMessage.trim(),
        userEmail: feedbackEmail.trim(),
        screenshotName: feedbackScreenshotName || undefined,
        screenshotDataUrl: feedbackScreenshotDataUrl || undefined,
        metadata,
      })

      if (result.success) {
        success('Feedback sent successfully. Thank you for helping us improve.')
        setFeedbackSubmitStatus({ type: 'success', message: 'Feedback sent successfully. Thank you for helping us improve.' })
        setFeedbackMessage('')
        setFeedbackScreenshotName('')
        setFeedbackScreenshotDataUrl('')
      } else if (result.cachedForRetry) {
        info('Feedback was saved and will retry automatically.')
        setFeedbackSubmitStatus({ type: 'error', message: `Feedback could not be sent right now. ${result.error || ''} It was saved for automatic retry.`.trim() })
      } else {
        error('Feedback could not be sent. Please try again.')
        setFeedbackSubmitStatus({ type: 'error', message: result.error || 'Feedback could not be sent.' })
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unknown error'
      console.error('Feedback submit threw error:', submitError)
      const metadata = await getFeedbackRuntimeMetadata(`${window.location.pathname} (settings-tab:${activeTab})`)
      queueFeedbackForRetry({
        feedbackType,
        message: feedbackMessage.trim(),
        userEmail: feedbackEmail.trim(),
        screenshotName: feedbackScreenshotName || undefined,
        screenshotDataUrl: feedbackScreenshotDataUrl || undefined,
        metadata,
      })

      info('Feedback was saved and will retry automatically.')
      setFeedbackSubmitStatus({ type: 'error', message: `Could not send feedback. ${message}. Saved for retry.` })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'help-support' || hasRetriedQueuedFeedback || !isOnline) {
      return
    }

    setHasRetriedQueuedFeedback(true)
    retryQueuedFeedback()
      .then((result) => {
        if (typeof result.sent === 'number' && result.sent > 0) {
          success(`Sent ${result.sent} queued feedback submission(s)`)
        }
      })
      .catch(() => {
        // ignore background retry failures
      })
  }, [activeTab, hasRetriedQueuedFeedback, isOnline, success])

  // Shortcut categories for grouping
  const shortcutsByCategory = useMemo(() => {
    const categories: Record<string, typeof store.keyboardShortcuts> = {
      navigation: [],
      actions: [],
      system: [],
      productivity: []
    }
    store.keyboardShortcuts.forEach(s => {
      if (categories[s.category]) {
        categories[s.category].push(s)
      }
    })
    return categories
  }, [store.keyboardShortcuts])

  const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    navigation: { label: 'Navigation', icon: <Globe className="h-4 w-4" /> },
    actions: { label: 'Actions', icon: <Zap className="h-4 w-4" /> },
    system: { label: 'System', icon: <Settings2 className="h-4 w-4" /> },
    productivity: { label: 'Productivity', icon: <Sparkles className="h-4 w-4" /> }
  }

  // Get user initials for avatar
  const userInitials = useMemo(() => {
    if (!store.userProfile?.name) return 'U'
    return store.userProfile.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [store.userProfile])

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-green-400 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize your Progress OS experience
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Button onClick={handleSaveProfile} className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-6 bg-secondary/30 dark:bg-secondary/20 p-1 rounded-xl border-transparent">
          <TabsTrigger value="profile" className="gap-2 rounded-lg">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2 rounded-lg">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 rounded-lg">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2 rounded-lg">
            <Cloud className="h-4 w-4" />
            <span className="hidden sm:inline">Sync</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2 rounded-lg">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="keyboard" className="gap-2 rounded-lg">
            <Keyboard className="h-4 w-4" />
            <span className="hidden sm:inline">Keyboard</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                User Profile
              </CardTitle>
              <CardDescription>
                Your personal information and identity across Progress OS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar and basic info */}
              <div className="flex items-start gap-6">
                <div className="relative group flex flex-col items-center gap-2">
                  <Avatar className="h-24 w-24 border-4 border-primary/20">
                    <AvatarImage src={store.userProfile?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border-none shadow-sm hover:shadow-md transition-all"
                      onClick={async () => {
                        try {
                          const filePath = await electron.selectFile({
                            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
                          })
                          if (filePath) {
                            // Convert file path to a file:// URL for local images
                            const avatarUrl = `file://${filePath.replace(/\\/g, '/')}`
                            store.updateUserProfile({ avatar: avatarUrl })
                            success('Avatar updated successfully')
                          }
                        } catch (err) {
                          error('Failed to upload avatar')
                        }
                      }}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {store.userProfile?.avatar ? 'Change' : 'Upload'}
                    </Button>
                    {store.userProfile?.avatar && (
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-none shadow-sm hover:shadow-md transition-all"
                        onClick={() => {
                          store.updateUserProfile({ avatar: undefined })
                          success('Avatar removed')
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                      <Input
                        id="name"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Enter your name"
                        className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20"
                      />
                    </div>
                  </div>
                  {store.userProfile?.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      Member since {format(new Date(store.userProfile.createdAt), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Regional Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Regional Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Timezone
                    </Label>
                    <Select
                      value={store.timezone}
                      onValueChange={(value) => store.setTimezone(value)}
                    >
                      <SelectTrigger className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                        <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="weekStart" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Week Starts On
                    </Label>
                    <Select
                      value={store.weekStart}
                      onValueChange={(value: 'sunday' | 'monday') => store.setWeekStart(value)}
                    >
                      <SelectTrigger className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sunday">Sunday</SelectItem>
                        <SelectItem value="monday">Monday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language" className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      Language
                    </Label>
                    <Select
                      value={store.language}
                      onValueChange={(value) => store.setLanguage(value)}
                    >
                      <SelectTrigger className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Data Management */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Data Management
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={() => navigate('/backup')}
                    className="h-auto py-4 justify-start gap-3 bg-blue-500/10 border-none hover:bg-blue-500/20 text-foreground shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Backup & Restore</p>
                      <p className="text-xs text-muted-foreground">Manage your data backups</p>
                    </div>
                  </Button>
                  <Button 
                    onClick={handleReset}
                    className="h-auto py-4 justify-start gap-3 bg-amber-500/10 border-none hover:bg-amber-500/20 text-foreground shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Reset All Settings</p>
                      <p className="text-xs text-muted-foreground">Restore to default values</p>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="mt-6 space-y-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SettingItem
                icon={<Monitor className="h-4 w-4" />}
                title="Theme"
                description="Choose your preferred color scheme"
              >
                <Select
                  value={theme}
                  onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Eye className="h-4 w-4" />}
                title="High Contrast Mode"
                description="Increase contrast for better readability"
              >
                <Switch
                  checked={store.highContrastMode}
                  onCheckedChange={(checked) => store.setHighContrastMode(checked)}
                />
              </SettingItem>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="mt-6 space-y-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Control how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SettingItem
                icon={<BellRing className="h-4 w-4" />}
                title="Enable Notifications"
                description="Turn on/off all notifications"
              >
                <Switch
                  checked={store.notificationSettings.enabled}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ enabled: checked })
                  }
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Volume2 className="h-4 w-4" />}
                title="Sound Effects"
                description="Play sounds for notifications"
              >
                <Switch
                  checked={store.notificationSettings.sound}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ sound: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Monitor className="h-4 w-4" />}
                title="Desktop Notifications"
                description="Show system notifications"
              >
                <Switch
                  checked={store.notificationSettings.desktop}
                  onCheckedChange={async (checked) => {
                    if (checked && typeof window !== 'undefined' && 'Notification' in window) {
                      if (Notification.permission === 'denied') {
                        error('Desktop notifications are blocked in system settings')
                        return
                      }

                      if (Notification.permission === 'default') {
                        const permission = await Notification.requestPermission()
                        if (permission !== 'granted') {
                          error('Desktop notification permission was not granted')
                          return
                        }
                      }
                    }

                    store.updateNotificationSettings({ desktop: checked })
                  }}
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Mail className="h-4 w-4" />}
                title="Email Notifications"
                description="Receive updates via email"
              >
                <Switch
                  checked={store.notificationSettings.email}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ email: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>
            </CardContent>
          </Card>

          {/* Reminder Settings */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Reminders
              </CardTitle>
              <CardDescription>
                Configure which reminders you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SettingItem
                title="Task Reminders"
                description="Get notified about upcoming tasks"
              >
                <Switch
                  checked={store.notificationSettings.taskReminders}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ taskReminders: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <SettingItem
                title="Task Reminder Time"
                description="Daily time for task reminders"
              >
                <Input
                  type="time"
                  value={store.notificationSettings.taskReminderTime}
                  onChange={(e) =>
                    store.updateNotificationSettings({ taskReminderTime: e.target.value })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.taskReminders}
                  className="w-[140px]"
                />
              </SettingItem>

              <Separator />

              <SettingItem
                title="Habit Reminders"
                description="Get notified about habit check-ins"
              >
                <Switch
                  checked={store.notificationSettings.habitReminders}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ habitReminders: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <SettingItem
                title="Habit Reminder Time"
                description="Daily time for habit check-in reminders"
              >
                <Input
                  type="time"
                  value={store.notificationSettings.habitReminderTime}
                  onChange={(e) =>
                    store.updateNotificationSettings({ habitReminderTime: e.target.value })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.habitReminders}
                  className="w-[140px]"
                />
              </SettingItem>

              <Separator />

              <SettingItem
                title="Goal Deadlines"
                description="Get notified about approaching goal deadlines"
              >
                <Switch
                  checked={store.notificationSettings.goalDeadlines}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ goalDeadlines: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <SettingItem
                title="Goal Deadline Lead Time"
                description="How many days before deadline to notify"
              >
                <Select
                  value={(store.notificationSettings?.goalDeadlineDaysAhead ?? 3).toString()}
                  onValueChange={(value) =>
                    store.updateNotificationSettings({ goalDeadlineDaysAhead: parseInt(value, 10) })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.goalDeadlines}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="2">2 days</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>

              <Separator />

              <SettingItem
                title="Goal Reminder Time"
                description="Daily time to check approaching goal deadlines"
              >
                <Input
                  type="time"
                  value={store.notificationSettings.goalReminderTime}
                  onChange={(e) =>
                    store.updateNotificationSettings({ goalReminderTime: e.target.value })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.goalDeadlines}
                  className="w-[140px]"
                />
              </SettingItem>

              <Separator />

              <SettingItem
                title="Review Reminders"
                description="Get reminders for daily, weekly, and monthly reviews"
              >
                <Switch
                  checked={store.notificationSettings.reviewReminders}
                  onCheckedChange={(checked) =>
                    store.updateNotificationSettings({ reviewReminders: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                title="Review Reminder Time"
                description="Daily time to evaluate pending reviews"
              >
                <Input
                  type="time"
                  value={store.notificationSettings.reviewReminderTime}
                  onChange={(e) =>
                    store.updateNotificationSettings({ reviewReminderTime: e.target.value })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.reviewReminders}
                  className="w-[140px]"
                />
              </SettingItem>

              <Separator />

              <SettingItem
                title="Daily Summary"
                description="Receive a daily summary of your progress"
              >
                <Switch
                  checked={store.notificationSettings.dailySummary}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ dailySummary: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <SettingItem
                title="Daily Summary Time"
                description="When to receive your daily productivity summary"
              >
                <Input
                  type="time"
                  value={store.notificationSettings.dailySummaryTime}
                  onChange={(e) =>
                    store.updateNotificationSettings({ dailySummaryTime: e.target.value })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.dailySummary}
                  className="w-[140px]"
                />
              </SettingItem>

              <Separator />

              <SettingItem
                title="Weekly Report"
                description="Receive a weekly productivity report"
              >
                <Switch
                  checked={store.notificationSettings.weeklyReport}
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ weeklyReport: checked })
                  }
                  disabled={!store.notificationSettings.enabled}
                />
              </SettingItem>

              <SettingItem
                title="Weekly Report Day"
                description="Choose which day your weekly report is sent"
              >
                <Select
                  value={store.notificationSettings.weeklyReportDay}
                  onValueChange={(value: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday') =>
                    store.updateNotificationSettings({ weeklyReportDay: value })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.weeklyReport}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="tuesday">Tuesday</SelectItem>
                    <SelectItem value="wednesday">Wednesday</SelectItem>
                    <SelectItem value="thursday">Thursday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>

              <Separator />

              <SettingItem
                title="Weekly Report Time"
                description="Time to receive the weekly report"
              >
                <Input
                  type="time"
                  value={store.notificationSettings.weeklyReportTime}
                  onChange={(e) =>
                    store.updateNotificationSettings({ weeklyReportTime: e.target.value })
                  }
                  disabled={!store.notificationSettings.enabled || !store.notificationSettings.weeklyReport}
                  className="w-[140px]"
                />
              </SettingItem>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync & Backup Settings */}
        <TabsContent value="sync" className="mt-6 space-y-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary" />
                Sync Settings
              </CardTitle>
              <CardDescription>
                Configure cloud synchronization for your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SettingItem
                icon={<RefreshCw className="h-4 w-4" />}
                title="Enable Sync"
                description="Synchronize data across devices"
              >
                <Switch
                  checked={syncEnabled}
                  onCheckedChange={(checked) => {
                    enableSync(checked)
                    if (checked) {
                      store.updatePrivacySettings({ localOnly: false })
                    }
                  }}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Cloud className="h-4 w-4" />}
                title="Sync Provider"
                description="Choose your sync provider"
              >
                <Select
                  value={syncProvider}
                  onValueChange={(value: 'local' | 'supabase' | 'custom') => 
                    setSyncProvider(value)
                  }
                  disabled={!syncEnabled}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Only</SelectItem>
                    <SelectItem value="supabase">Supabase</SelectItem>
                    <SelectItem value="custom">Custom Server</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Clock className="h-4 w-4" />}
                title="Sync Interval"
                description="How often to sync data (in minutes)"
              >
                <Select
                  value={(syncInterval ?? 5).toString()}
                  onValueChange={(value) => setSyncInterval(parseInt(value))}
                  disabled={!syncEnabled}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Zap className="h-4 w-4" />}
                title="Auto Sync"
                description="Automatically sync when changes are made"
              >
                <Switch
                  checked={autoSync}
                  onCheckedChange={(checked) => setAutoSync(checked)}
                  disabled={!syncEnabled}
                />
              </SettingItem>

              <Separator />

              <div className="flex items-center justify-end gap-2 py-2">
                <Button
                  disabled={!syncEnabled || store.syncStatus === 'syncing'}
                  className="bg-green-500/90 hover:bg-green-600 text-white shadow-sm hover:shadow-md border-none transition-all"
                  onClick={async () => {
                    if (!electron.isReady) {
                      info('Sync works in the desktop app environment')
                      return
                    }

                    try {
                      store.updateSyncStatus('syncing')
                      await electron.setSyncConfig({
                        enabled: syncEnabled,
                        provider: syncProvider,
                        syncInterval: syncInterval,
                      })
                      await electron.syncStart()
                      store.updateLastSync()
                      store.updateSyncStatus('idle')
                      success('Sync completed successfully')
                    } catch (syncError) {
                      store.updateSyncStatus('error')
                      error('Sync failed', syncError instanceof Error ? syncError.message : 'Unknown sync error')
                    }
                  }}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${store.syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  {store.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>

              {store.lastSync && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500" />
                      Last synced: {format(new Date(store.lastSync), 'MMM d, yyyy h:mm a')}
                    </div>
                    <Badge variant={store.syncStatus === 'syncing' ? 'default' : 'secondary'}>
                      {store.syncStatus === 'syncing' ? 'Syncing...' : 'Up to date'}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Backup Section */}
          <Card className="border border-destructive/30 shadow-lg bg-gradient-to-br from-card to-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Backup
              </CardTitle>
              <CardDescription>
                Protect your data with automatic backups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-background/50 space-y-1">
                  <p className="text-2xl font-bold">{backup.stats.totalBackups}</p>
                  <p className="text-sm text-muted-foreground">Total Backups</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 space-y-1">
                  <p className="text-2xl font-bold">
                    {backup.stats.newestBackup 
                      ? backup.formatDate(backup.stats.newestBackup)
                      : 'Never'}
                  </p>
                  <p className="text-sm text-muted-foreground">Last Backup</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 space-y-1">
                  <p className="text-2xl font-bold">
                    {backup.stats.totalSizeFormatted}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => backup.createBackup()}
                  disabled={backup.isCreatingBackup}
                  className="flex-1"
                >
                  {backup.isCreatingBackup ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Create Backup Now
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => navigate('/backup')}
                  className="border-none bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 shadow-sm hover:shadow-md transition-all"
                >
                  View All Backups
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Settings */}
        <TabsContent value="privacy" className="mt-6 space-y-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Privacy Settings
              </CardTitle>
              <CardDescription>
                Control your data and privacy preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <SettingItem
                icon={<Lock className="h-4 w-4" />}
                title="Local Only Mode"
                description="Keep all data stored locally on your device"
              >
                <Switch
                  checked={store.privacySettings.localOnly}
                  onCheckedChange={(checked) => {
                    store.updatePrivacySettings({ localOnly: checked })
                    if (checked) {
                      store.enableSync(false)
                      info('Cloud sync has been disabled')
                    }
                  }}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Eye className="h-4 w-4" />}
                title="Anonymous Analytics"
                description="Help improve Progress OS with anonymous usage data"
              >
                <Switch
                  checked={store.privacySettings.analytics}
                  onCheckedChange={(checked) => 
                    store.updatePrivacySettings({ analytics: checked })
                  }
                  disabled={store.privacySettings.localOnly}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Crash Reports"
                description="Automatically send crash reports to help fix bugs"
              >
                <Switch
                  checked={store.privacySettings.crashReports}
                  onCheckedChange={(checked) => 
                    store.updatePrivacySettings({ crashReports: checked })
                  }
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Database className="h-4 w-4" />}
                title="Data Collection"
                description="Allow collection of feature usage statistics"
              >
                <Switch
                  checked={store.privacySettings.dataCollection}
                  onCheckedChange={(checked) => 
                    store.updatePrivacySettings({ dataCollection: checked })
                  }
                  disabled={store.privacySettings.localOnly}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Cloud className="h-4 w-4" />}
                title="Share Usage Data"
                description="Share anonymous usage patterns to improve features"
              >
                <Switch
                  checked={store.privacySettings.shareUsageData}
                  onCheckedChange={(checked) => 
                    store.updatePrivacySettings({ shareUsageData: checked })
                  }
                  disabled={store.privacySettings.localOnly}
                />
              </SettingItem>
            </CardContent>
          </Card>

          {/* Data Actions */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">
                <Trash2 className="h-5 w-5 text-red-500" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible data actions - proceed with extreme caution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50/50 to-red-50/20 dark:from-red-950/20 dark:to-red-950/10 border border-red-200/50 dark:border-red-800/30 hover:border-red-300/70 dark:hover:border-red-700/50 transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground mb-1">Enable History Deletion</p>
                    <p className="text-sm text-muted-foreground">
                      Danger Zone. When enabled, permanent delete also removes historical progress data.
                    </p>
                  </div>
                  <Switch
                    checked={store.allowHistoryDeletion}
                    onCheckedChange={(checked) => store.setAllowHistoryDeletion(checked)}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50/50 to-orange-50/30 dark:from-red-950/20 dark:to-orange-950/15 border border-red-200/50 dark:border-red-800/30 hover:border-red-300/70 dark:hover:border-red-700/50 transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground mb-1">Reset All Application Data</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete all tasks, habits, goals, notes, reviews, and settings. 
                      This will restart the app with a completely fresh state.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="bg-red-500/90 text-white border-none shadow-sm text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Cannot be undone
                      </Badge>
                      <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-none shadow-sm text-xs">
                        <HardDrive className="h-3 w-3 mr-1" />
                        Deletes database
                      </Badge>
                      <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-none shadow-sm text-xs">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Auto-restarts app
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    variant="destructive"
                    size="lg"
                    onClick={() => setResetDialogOpen(true)}
                    className="flex-shrink-0 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl text-white border-none transition-all"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset All Data
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50/50 to-rose-50/20 dark:from-red-950/20 dark:to-rose-950/10 border border-red-200/50 dark:border-red-800/30 hover:border-red-300/70 dark:hover:border-red-700/50 transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground mb-1">Clear Notification & Sync Caches</p>
                    <p className="text-sm text-muted-foreground">
                      Deletes local reminder logs, notification history, and sync cache snapshots without removing your actual productivity data.
                    </p>
                  </div>
                  <Button 
                    variant="destructive"
                    onClick={() => handleClearPrivacyCaches()}
                    disabled={isClearingCaches}
                    className="flex-shrink-0 bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg text-white border-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearingCaches ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Local Caches
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50/50 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/10 border border-blue-200/50 dark:border-blue-800/30">
                <p className="text-xs text-muted-foreground text-center">
                  <strong className="text-blue-600 dark:text-blue-400">💡 Tip:</strong> Create a backup before resetting if you want to preserve your data. 
                  Backups are kept even after reset and can be restored later.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keyboard Shortcuts */}
        <TabsContent value="keyboard" className="mt-6 space-y-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Keyboard className="h-5 w-5 text-primary" />
                    Keyboard Shortcuts
                  </CardTitle>
                  <CardDescription>
                    Customize keyboard shortcuts for faster navigation
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="shortcuts-toggle" className="text-sm">
                      Enable Shortcuts
                    </Label>
                    <Switch
                      id="shortcuts-toggle"
                      checked={store.keyboardShortcutsEnabled}
                      onCheckedChange={(checked) => store.setKeyboardShortcutsEnabled(checked)}
                    />
                  </div>
                  <Button 
                    size="sm"
                    className="bg-green-500/90 hover:bg-green-600 text-white shadow-sm hover:shadow-md border-none transition-all"
                    onClick={() => {
                      store.resetKeyboardShortcuts()
                      success('Shortcuts reset to default')
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        {categoryLabels[category]?.icon}
                        {categoryLabels[category]?.label || category}
                      </div>
                      <div className="space-y-2">
                        {shortcuts.map((shortcut) => (
                          <ShortcutEditor
                            key={shortcut.id}
                            shortcut={shortcut}
                            onUpdate={handleShortcutUpdate}
                            onToggle={store.toggleKeyboardShortcut}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Help & Support */}
        <TabsContent value="help-support" className="mt-6 space-y-6">
          {/* Contact Section */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500/5 to-green-500/10 dark:from-green-500/10 dark:to-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-green-500" />
                Help & Support Team
              </CardTitle>
              <CardDescription>
                Contact us for assistance, questions, or general support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-zinc-900 border border-green-500/20">
                <Mail className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">progressoshelp@gmail.com</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Our support team typically responds within 24 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Help & Support — Feedback
              </CardTitle>
              <CardDescription>
                Report bugs, share suggestions, and request features. Submissions include app diagnostics to help troubleshooting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="feedback-type">Feedback Type</Label>
                <Select value={feedbackType} onValueChange={(value: 'bug-report' | 'suggestion' | 'feature-request' | 'general-feedback') => setFeedbackType(value)}>
                  <SelectTrigger id="feedback-type" className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15">
                    <SelectValue placeholder="Select feedback type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug-report">Bug Report</SelectItem>
                    <SelectItem value="suggestion">Suggestion</SelectItem>
                    <SelectItem value="feature-request">Feature Request</SelectItem>
                    <SelectItem value="general-feedback">General Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-message">Message <span className="text-destructive">*</span></Label>
                <Textarea
                  id="feedback-message"
                  value={feedbackMessage}
                  onChange={(event) => setFeedbackMessage(event.target.value)}
                  placeholder="Describe the issue or idea in detail..."
                  className="min-h-[140px] bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15"
                  required
                  aria-required="true"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="feedback-screenshot" className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    Screenshot Upload (optional)
                  </Label>
                  <Input
                    id="feedback-screenshot"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFeedbackScreenshotChange}
                    className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15"
                  />
                  {feedbackScreenshotName && (
                    <p className="text-xs text-muted-foreground">Attached: {feedbackScreenshotName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-email">User Email</Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    value={feedbackEmail}
                    onChange={(event) => {
                      setFeedbackEmailTouched(true)
                      setFeedbackEmail(event.target.value)
                    }}
                    placeholder="your@email.com"
                    className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15"
                  />
                  <p className="text-xs text-muted-foreground">Auto-filled from your profile; you can edit before submitting.</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                Metadata included automatically: App Version, Operating System, Date/Time, and Current Tab/Page.
              </div>

              {!isOnline && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  No internet connection. Please reconnect and try again.
                </div>
              )}

              {feedbackSubmitStatus && (
                <div
                  className={feedbackSubmitStatus.type === 'success'
                    ? 'rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300'
                    : 'rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300'}
                >
                  {feedbackSubmitStatus.message}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmittingFeedback || !isOnline}
                  className="bg-green-500/90 hover:bg-green-600 text-white shadow-sm hover:shadow-md border-none transition-all"
                >
                  {isSubmittingFeedback ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </span>
                  ) : 'Submit Feedback'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Data Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => {
        setResetDialogOpen(open)
        if (!open) setResetConfirmation('')
      }}>
        <DialogContent className="max-w-md bg-card max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset All Data
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete all your data.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <p className="font-semibold">Warning: This will delete:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All tasks and history</li>
                  <li>All habits and streaks</li>
                  <li>All goals and progress</li>
                  <li>All notes and journals</li>
                  <li>All settings and preferences</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <Label>To confirm, type "RESET" below</Label>
                <Input 
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="RESET"
                  className="border-destructive/50 focus-visible:ring-destructive/50"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleResetAllData}
              disabled={resetConfirmation !== 'RESET'}
            >
              Reset All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}