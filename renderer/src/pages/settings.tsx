import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
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
  Download,
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
  HardDrive
} from 'lucide-react'
import { useStore } from '@/store'
import { useToaster } from '@/hooks/use-toaster'
import { useElectron } from '@/hooks/use-electron'
import { useTheme } from '@/components/theme-provider'
import { useBackup } from '@/hooks/use-backup'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

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
  const store = useStore()
  const { success, info, error, warning } = useToaster()
  const electron = useElectron()
  const { theme, setTheme } = useTheme()
  const backup = useBackup()
  
  // Local form state - initialized from store
  const [profileName, setProfileName] = useState(store.userProfile.name)
  const [profileEmail, setProfileEmail] = useState(store.userProfile.email)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  // Sync local state with store changes
  useEffect(() => {
    setProfileName(store.userProfile.name)
    setProfileEmail(store.userProfile.email)
  }, [store.userProfile.name, store.userProfile.email])

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = 
      profileName !== store.userProfile.name ||
      profileEmail !== store.userProfile.email
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

  // Handle import/export
  const handleImport = async () => {
    try {
      const filePath = await electron.selectFile({
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (filePath) {
        info('Importing settings...')
        success('Settings imported successfully')
      }
    } catch (err) {
      error('Failed to import settings')
    }
  }

  const handleExport = async () => {
    try {
      const settingsData = {
        userProfile: store.userProfile,
        timezone: store.timezone,
        weekStart: store.weekStart,
        language: store.language,
        compactMode: store.compactMode,
        animationsEnabled: store.animationsEnabled,
        soundEnabled: store.soundEnabled,
        highContrastMode: store.highContrastMode,
        reduceMotion: store.reduceMotion,
        notificationSettings: store.notificationSettings,
        privacySettings: store.privacySettings,
        keyboardShortcuts: store.keyboardShortcuts,
        keyboardShortcutsEnabled: store.keyboardShortcutsEnabled,
        syncEnabled: store.syncEnabled,
        syncProvider: store.syncProvider,
        syncInterval: store.syncInterval,
        autoSync: store.autoSync,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }
      
      const filePath = await electron.saveFile({
        defaultPath: `progress-os-settings-${format(new Date(), 'yyyy-MM-dd')}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      
      if (filePath) {
        // In a real implementation, write settingsData to the file via electron
        console.log('Exporting settings to:', filePath, settingsData)
        success('Settings exported successfully')
      }
    } catch (err) {
      error('Failed to export settings')
    }
  }

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
      store.resetAllSettings()
      setProfileName('')
      setProfileEmail('')
      success('Settings reset to default')
    }
  }

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
    if (!store.userProfile.name) return 'U'
    return store.userProfile.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [store.userProfile.name])

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
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleImport} className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
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
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-4 border-primary/20">
                    <AvatarImage src={store.userProfile.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => info('Avatar upload coming soon')}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
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
                  {store.userProfile.createdAt && (
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
                    variant="outline" 
                    onClick={() => navigate('/backup')}
                    className="h-auto py-4 justify-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <HardDrive className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Backup & Restore</p>
                      <p className="text-xs text-muted-foreground">Manage your data backups</p>
                    </div>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    className="h-auto py-4 justify-start gap-3 hover:bg-destructive/10 hover:border-destructive/50"
                  >
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <RotateCcw className="h-5 w-5 text-destructive" />
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
                icon={<Settings2 className="h-4 w-4" />}
                title="Compact Mode"
                description="Use more compact spacing for lists and elements"
              >
                <Switch
                  checked={store.compactMode}
                  onCheckedChange={(checked) => store.setCompactMode(checked)}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Sparkles className="h-4 w-4" />}
                title="Animations"
                description="Enable smooth transitions and animations"
              >
                <Switch
                  checked={store.animationsEnabled}
                  onCheckedChange={(checked) => store.setAnimationsEnabled(checked)}
                />
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

              <Separator />

              <SettingItem
                icon={<Zap className="h-4 w-4" />}
                title="Reduce Motion"
                description="Minimize animations and transitions"
              >
                <Switch
                  checked={store.reduceMotion}
                  onCheckedChange={(checked) => store.setReduceMotion(checked)}
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
                  onCheckedChange={(checked) => 
                    store.updateNotificationSettings({ desktop: checked })
                  }
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
                  checked={store.syncEnabled}
                  onCheckedChange={(checked) => store.enableSync(checked)}
                />
              </SettingItem>

              <Separator />

              <SettingItem
                icon={<Cloud className="h-4 w-4" />}
                title="Sync Provider"
                description="Choose your sync provider"
              >
                <Select
                  value={store.syncProvider}
                  onValueChange={(value: 'local' | 'supabase' | 'custom') => 
                    store.setSyncProvider(value)
                  }
                  disabled={!store.syncEnabled}
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
                  value={store.syncInterval.toString()}
                  onValueChange={(value) => store.setSyncInterval(parseInt(value))}
                  disabled={!store.syncEnabled}
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
                  checked={store.autoSync}
                  onCheckedChange={(checked) => store.setAutoSync(checked)}
                  disabled={!store.syncEnabled}
                />
              </SettingItem>

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
          <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
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
                    {backup.stats.lastBackup 
                      ? format(backup.stats.lastBackup, 'MMM d')
                      : 'Never'}
                  </p>
                  <p className="text-sm text-muted-foreground">Last Backup</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 space-y-1">
                  <p className="text-2xl font-bold">
                    {backup.formatFileSize(backup.stats.totalSize)}
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
                  variant="outline" 
                  onClick={() => navigate('/backup')}
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
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible data actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Clear All Data</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete all tasks, habits, goals, and notes
                    </p>
                  </div>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm('Are you sure? This will permanently delete ALL your data and cannot be undone.')) {
                        warning('Feature coming soon - data not cleared for safety')
                      }
                    }}
                  >
                    Clear Data
                  </Button>
                </div>
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
                    variant="outline" 
                    size="sm"
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
                            onUpdate={store.updateKeyboardShortcut}
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
      </Tabs>
    </div>
  )
}