import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
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
  Upload
} from 'lucide-react'
import { useStore } from '@/store'
import { useToaster } from '@/hooks/use-toaster'
import { useElectron } from '@/hooks/use-electron'
import { useTheme } from '@/components/theme-provider'

interface SettingsState {
  name: string;
  email: string;
  timezone: string;
  weekStart: 'sunday' | 'monday';
  language: string;
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  animations: boolean; // Corresponds to animationsEnabled in store
  enableNotifications: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  emailNotifications: boolean;
  syncEnabled: boolean;
  syncProvider: string;
  syncInterval: number;
  autoSync: boolean;
  dataCollection: boolean;
  analytics: boolean;
  crashReports: boolean;
  enableShortcuts: boolean;
  customShortcuts: Record<string, string>;
}

export default function Settings() {
  const navigate = useNavigate()
  const store = useStore()
  const { success, info, error } = useToaster()
  const electron = useElectron()
  const { theme, setTheme } = useTheme()
  
  const [settings, setSettings] = useState<SettingsState>({
    // Profile
    name: '',
    email: '',
    timezone: store.timezone,
    weekStart: store.weekStart,
    language: store.language,
    
    // Appearance
    theme: theme,
    compactMode: store.compactMode,
    animations: store.animationsEnabled, // Mapped from animationsEnabled
    
    // Notifications
    enableNotifications: true,
    soundEnabled: store.soundEnabled,
    desktopNotifications: true,
    emailNotifications: false,
    
    // Sync
    syncEnabled: store.syncEnabled,
    syncProvider: 'supabase',
    syncInterval: 5,
    autoSync: true,
    
    // Privacy
    dataCollection: false,
    analytics: true,
    crashReports: true,
    
    // Keyboard
    enableShortcuts: true,
    customShortcuts: {},
  })

  const handleSave = () => {
    // Update store with new settings
    // Since toggleTheme just toggles, we need to explicitly set the theme
    // A better approach would be to have a `setTheme` action in the store
    if (settings.theme !== theme) {
      setTheme(settings.theme)
    }
    store.enableSync(settings.syncEnabled)
    // Update other store preferences
    // store.setTimezone(settings.timezone) // If such an action existed
    // store.setWeekStart(settings.weekStart)
    // store.setLanguage(settings.language)
    // store.setCompactMode(settings.compactMode)
    // store.setAnimationsEnabled(settings.animations)
    // store.setSoundEnabled(settings.soundEnabled)
    
    success('Settings saved successfully')
  }

  const handleImport = async () => {
    try {
      const filePath = await electron.selectFile({
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (filePath) {
        info('Import started')
        // Import logic here
      }
    } catch (err) {
      error('Failed to import settings')
    }
  }

  const handleExport = async () => {
    try {
      const filePath = await electron.saveFile({
        defaultPath: 'progress-os-settings.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (filePath) {
        success('Settings exported successfully')
      }
    } catch (err) {
      error('Failed to export settings')
    }
  }

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      // Reset logic
      success('Settings reset to default')
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Customize your Progress OS experience
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="flex-1">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex-1">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex-1">
            <Cloud className="mr-2 h-4 w-4" />
            Sync & Backup
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex-1">
            <Shield className="mr-2 h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="keyboard" className="flex-1">
            <Keyboard className="mr-2 h-4 w-4" />
            Keyboard
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={settings.timezone}
                      onValueChange={(value: string) => setSettings({ ...settings, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="weekStart">Week Start</Label>
                    <Select
                      value={settings.weekStart}
                      onValueChange={(value: 'sunday' | 'monday') => 
                        setSettings({ ...settings, weekStart: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sunday">Sunday</SelectItem>
                        <SelectItem value="monday">Monday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={settings.language}
                    onValueChange={(value: string) => setSettings({ ...settings, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data Management</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={() => navigate('/backup')}>
                    <Database className="mr-2 h-4 w-4" />
                    Backup & Restore
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Reset All Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Theme</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose between light and dark mode
                    </p>
                  </div>
                  <Select
                    value={settings.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') => 
                      setSettings({ ...settings, theme: value })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Use more compact spacing for lists and elements
                    </p>
                  </div>
                  <Switch
                    checked={settings.compactMode}
                    onCheckedChange={(checked: boolean) => 
                      setSettings({ ...settings, compactMode: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Animations</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable smooth transitions and animations
                    </p>
                  </div>
                  <Switch
                    checked={settings.animations}
                    onCheckedChange={(checked: boolean) => 
                      setSettings({ ...settings, animations: checked })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Accessibility</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Contrast Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Increase contrast for better readability
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Reduce Motion</Label>
                    <p className="text-sm text-muted-foreground">
                      Minimize animations and transitions
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other settings tabs would follow similar patterns */}
        <TabsContent value="notifications" className="mt-6">
          {/* Notification settings */}
        </TabsContent>
        
        <TabsContent value="sync" className="mt-6">
          {/* Sync and backup settings */}
        </TabsContent>
        
        <TabsContent value="privacy" className="mt-6">
          {/* Privacy settings */}
        </TabsContent>
        
        <TabsContent value="keyboard" className="mt-6">
          {/* Keyboard shortcuts settings */}
        </TabsContent>
      </Tabs>
    </div>
  )
}