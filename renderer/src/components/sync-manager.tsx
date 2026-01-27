import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Wifi, 
  WifiOff,
  Upload,
  Download,
  Settings,
  Key
} from 'lucide-react'
import { useElectron } from '@/hooks/use-electron'
import { cn } from '@/lib/utils'

interface SyncConfig {
  enabled: boolean
  provider: 'supabase' | 'firebase' | 'custom'
  endpoint: string
  apiKey: string
  syncInterval: number
}

interface SyncStatus {
  isSyncing: boolean
  lastSync: string | null
  error: string | null
  pendingChanges: number
}

export function SyncManager() {
  const electron = useElectron()
  const [config, setConfig] = useState<SyncConfig>({
    enabled: false,
    provider: 'supabase',
    endpoint: '',
    apiKey: '',
    syncInterval: 5,
  })
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    error: null,
    pendingChanges: 0,
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load saved config
    const loadConfig = async () => {
      try {
        // In a real app, load from database or local storage
        const savedConfig = localStorage.getItem('sync-config')
        if (savedConfig) {
          setConfig(JSON.parse(savedConfig))
        }
      } catch (error) {
        console.error('Failed to load sync config:', error)
      }
    }

    loadConfig()
  }, [])

  useEffect(() => {
    // Save config when it changes
    localStorage.setItem('sync-config', JSON.stringify(config))
  }, [config])

  const handleSyncToggle = async (enabled: boolean) => {
    setConfig(prev => ({ ...prev, enabled }))
    
    if (enabled) {
      await startSync()
    } else {
      await stopSync()
    }
  }

  const startSync = async () => {
    if (!config.endpoint || !config.apiKey) {
      setStatus(prev => ({ ...prev, error: 'Please configure sync endpoint and API key' }))
      return
    }

    setIsLoading(true)
    setStatus(prev => ({ ...prev, error: null, isSyncing: true }))

    try {
      await electron.syncStart()
      setStatus(prev => ({ 
        ...prev, 
        isSyncing: false, 
        error: null,
        lastSync: new Date().toISOString()
      }))
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        isSyncing: false, 
        error: error instanceof Error ? error.message : 'Failed to start sync'
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const stopSync = async () => {
    setIsLoading(true)
    
    try {
      await electron.syncStop()
      setStatus(prev => ({ ...prev, isSyncing: false }))
    } catch (error) {
      console.error('Failed to stop sync:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const manualSync = async () => {
    if (status.isSyncing) return
    
    setIsLoading(true)
    setStatus(prev => ({ ...prev, error: null, isSyncing: true }))

    try {
      // Simulate sync
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        lastSync: new Date().toISOString(),
        pendingChanges: 0
      }))
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = () => {
    if (status.error) return 'destructive'
    if (status.isSyncing) return 'warning'
    if (config.enabled) return 'success'
    return 'secondary'
  }

  const getStatusIcon = () => {
    if (status.error) return <AlertCircle className="h-5 w-5" />
    if (status.isSyncing) return <RefreshCw className="h-5 w-5 animate-spin" />
    if (config.enabled) return <Wifi className="h-5 w-5" />
    return <WifiOff className="h-5 w-5" />
  }

  const getStatusText = () => {
    if (status.error) return 'Error'
    if (status.isSyncing) return 'Syncing...'
    if (config.enabled) return 'Connected'
    return 'Disabled'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cloud Sync</h2>
          <p className="text-muted-foreground">
            Keep your data synchronized across devices
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant={getStatusColor()} className="gap-2">
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.enabled}
              onCheckedChange={handleSyncToggle}
              disabled={isLoading}
            />
            <Label>{config.enabled ? 'Enabled' : 'Disabled'}</Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sync Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sync Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Sync Provider</Label>
              <Select
                value={config.provider}
                onValueChange={(value: 'supabase' | 'firebase' | 'custom') => 
                  setConfig(prev => ({ ...prev, provider: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supabase">Supabase</SelectItem>
                  <SelectItem value="firebase">Firebase</SelectItem>
                  <SelectItem value="custom">Custom API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                value={config.endpoint}
                onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder="https://your-project.supabase.co"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter your API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
              <Select
                value={config.syncInterval.toString()}
                onValueChange={(value) => 
                  setConfig(prev => ({ ...prev, syncInterval: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {status.error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{status.error}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfig({
                    enabled: false,
                    provider: 'supabase',
                    endpoint: '',
                    apiKey: '',
                    syncInterval: 5,
                  })
                }}
              >
                Reset
              </Button>
              
              <Button
                onClick={manualSync}
                disabled={isLoading || !config.enabled}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", status.isSyncing && "animate-spin")} />
                Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Last Sync</div>
                  <div className="text-sm text-muted-foreground">
                    {status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}
                  </div>
                </div>
                {status.lastSync && (
                  <CheckCircle className="h-5 w-5 text-status-completed" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Pending Changes</div>
                  <div className="text-sm text-muted-foreground">
                    {status.pendingChanges} items to sync
                  </div>
                </div>
                <Badge variant={status.pendingChanges > 0 ? 'warning' : 'success'}>
                  {status.pendingChanges > 0 ? 'Pending' : 'Synced'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Sync Interval</div>
                  <div className="text-sm text-muted-foreground">
                    Every {config.syncInterval} minutes
                  </div>
                </div>
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Data Usage</div>
                  <div className="text-sm text-muted-foreground">
                    ~2.4 MB transferred
                  </div>
                </div>
                <Cloud className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Sync Statistics</h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Goals Synced</span>
                    <span className="font-medium">24/24</span>
                  </div>
                  <Progress value={100} />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Tasks Synced</span>
                    <span className="font-medium">156/156</span>
                  </div>
                  <Progress value={100} />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Habits Synced</span>
                    <span className="font-medium">12/12</span>
                  </div>
                  <Progress value={100} />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  // Open sync logs
                }}
              >
                <Key className="h-4 w-4" />
                View Sync Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              // Backup to cloud
            }}
          >
            <Upload className="h-4 w-4" />
            Backup to Cloud
          </Button>
          
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              // Restore from cloud
            }}
          >
            <Download className="h-4 w-4" />
            Restore from Cloud
          </Button>
          
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              // View conflicts
            }}
          >
            <AlertCircle className="h-4 w-4" />
            Resolve Conflicts
          </Button>
        </div>
      </div>
    </div>
  )
}