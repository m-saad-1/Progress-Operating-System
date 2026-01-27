import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Calendar,
} from 'lucide-react'
import { useToaster } from '@/hooks/use-toaster'
import { useElectron } from '@/hooks/use-electron'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export function BackupManager() {
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const electron = useElectron()
  const { toast } = useToaster()

  const loadBackups = async () => {
    setLoading(true)
    try {
      const result = await electron.listBackups()
      if (Array.isArray(result)) {
        setBackups(result)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load backups',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // Calculate stats from backups
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0)
      const healthyBackups = backups.filter(b => b.exists).length
      
      setStats({
        totalBackups: backups.length,
        totalSize,
        healthyBackups,
        oldestBackup: backups[backups.length - 1],
        newestBackup: backups[0],
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  useEffect(() => {
    loadBackups()
  }, [])

  useEffect(() => {
    if (backups.length > 0) {
      loadStats()
    }
  }, [backups])

  const handleCreateBackup = async () => {
    setLoading(true)
    try {
      const result = await electron.createBackup()
      if (result) {
        toast({
          title: 'Backup created',
          description: `Backup ID: ${result}`,
          type: 'success',
        })
        await loadBackups()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create backup',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? This will replace your current data.')) {
      return
    }

    setLoading(true)
    try {
      const result = await electron.restoreBackup(backupId)
      if (result) {
        toast({
          title: 'Backup restored',
          description: 'Your data has been restored successfully',
          type: 'success',
        })
        // Reload the app
        window.location.reload()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to restore backup',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return
    }

    try {
      const result = await (electron as any).deleteBackup(backupId)
      if (result) {
        toast({
          title: 'Backup deleted',
          description: 'Backup has been deleted successfully',
          type: 'success',
        })
        await loadBackups()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete backup',
        type: 'error',
      })
    }
  }

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Backup Manager</h2>
          <p className="text-muted-foreground">
            Manage your data backups and restore points
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={loadBackups}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            onClick={handleCreateBackup}
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Create Backup
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBackups}</div>
              <div className="text-xs text-muted-foreground">
                {stats.healthyBackups} healthy
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatFileSize(stats.totalSize)}
              </div>
              <div className="text-xs text-muted-foreground">
                All backups combined
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Oldest Backup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {stats.oldestBackup ? format(new Date(stats.oldestBackup.timestamp), 'MMM d') : 'None'}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.oldestBackup?.dateFormatted || 'No backups'}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Newest Backup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {stats.newestBackup ? format(new Date(stats.newestBackup.timestamp), 'MMM d') : 'None'}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.newestBackup?.dateFormatted || 'No backups'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8">
              <HardDrive className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-medium">No backups yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first backup to protect your data
              </p>
              <Button className="mt-4" onClick={handleCreateBackup}>
                Create First Backup
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center",
                      backup.exists ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                    )}>
                      {backup.exists ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <AlertCircle className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">Backup {backup.id.slice(0, 8)}</h4>
                        <Badge variant={backup.exists ? "success" : "destructive"}>
                          {backup.exists ? "Healthy" : "Missing"}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {backup.dateFormatted}
                        </div>
                        <div>{backup.sizeFormatted}</div>
                        <div>Version: {backup.version}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreBackup(backup.id)}
                      disabled={!backup.exists}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Automatic Backups</h4>
                <p className="text-sm text-muted-foreground">
                  Create backups automatically every 6 hours
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="success">Enabled</Badge>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </div>
            <Progress value={75} className="h-1" />
            <p className="text-xs text-muted-foreground">
              Next backup in approximately 2 hours
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Backup Retention</h4>
                <p className="text-sm text-muted-foreground">
                  Keep last 30 backups, delete older ones automatically
                </p>
              </div>
              <Badge variant="outline">30 backups</Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Backup Location</h4>
                <p className="text-sm text-muted-foreground">
                  Backups are stored locally in your user data directory
                </p>
              </div>
              <Button variant="outline" size="sm">
                Change Location
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}