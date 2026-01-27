import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Download, 
  Upload, 
  Database, 
  Shield, 
  History,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  HardDrive,
  Cloud,
  FileText
} from 'lucide-react'
import { format } from 'date-fns'
import { useBackup } from '@/hooks/use-backup'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'

export default function Backup() {
  const backup = useBackup()
  const { toast, success, error, info } = useToaster()
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null)

  const handleCreateBackup = async () => {
    const result = await backup.createBackup()
    if (result) {
      success('Backup created successfully')
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    setRestoringBackupId(backupId)
    const restoreSuccess = await backup.restoreBackup(backupId)
    setRestoringBackupId(null)
    if (restoreSuccess) {
      success('Backup restored successfully')
    }
  }

  const handleDeleteBackup = async (backupId: string) => {
    if (window.confirm('Are you sure you want to delete this backup?')) {
      const deleteSuccess = await backup.deleteBackup(backupId)
      if (deleteSuccess) {
        success('Backup deleted')
      }
    }
  }

  const handleVerifyAll = async () => {
    const result = await backup.verifyAllBackups()
    info(`Verification complete: ${result.valid} valid, ${result.corrupted} corrupted`)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backup & Restore</h1>
          <p className="text-muted-foreground">
            Protect your data with automatic backups
          </p>
        </div>
        <Button onClick={handleCreateBackup} disabled={backup.isCreatingBackup}>
          <Database className="mr-2 h-4 w-4" />
          Create Backup Now
        </Button>
      </div>

      {/* Backup Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backup Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backup.backupHealth.healthy}/{backup.backupHealth.total}
            </div>
            <Progress 
              value={(backup.backupHealth.healthy / backup.backupHealth.total) * 100} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {backup.backupHealth.corrupted} corrupted backups
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backup.formatFileSize(backup.stats.totalSize)}
            </div>
            <p className="text-xs text-muted-foreground">
              {backup.stats.totalBackups} backups
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backup.latestBackup 
                ? format(backup.latestBackup.timestamp, 'MMM d')
                : 'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {backup.latestBackup 
                ? backup.formatFileSize(backup.latestBackup.size)
                : 'No backups yet'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Backup Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Configuration</CardTitle>
          <CardDescription>
            Configure automatic backup settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">Auto Backup</p>
              <p className="text-sm text-muted-foreground">
                Automatically create backups
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => backup.updateConfig({ autoBackup: !backup.config.autoBackup })}
            >
              {backup.config.autoBackup ? 'Disable' : 'Enable'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">Backup Interval</p>
              <p className="text-sm text-muted-foreground">
                How often to create backups
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="168"
                value={backup.config.backupInterval}
                onChange={(e) => backup.updateConfig({ backupInterval: parseInt(e.target.value) })}
                className="w-32"
              />
              <span className="text-sm w-16">{backup.config.backupInterval} hours</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">Max Backups</p>
              <p className="text-sm text-muted-foreground">
                Maximum number of backups to keep
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="5"
                max="100"
                value={backup.config.maxBackups}
                onChange={(e) => backup.updateConfig({ maxBackups: parseInt(e.target.value) })}
                className="w-32"
              />
              <span className="text-sm w-16">{backup.config.maxBackups}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">Compress Backups</p>
              <p className="text-sm text-muted-foreground">
                Compress backup files to save space
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => backup.updateConfig({ compressBackups: !backup.config.compressBackups })}
            >
              {backup.config.compressBackups ? 'Disable' : 'Enable'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">Encrypt Backups</p>
              <p className="text-sm text-muted-foreground">
                Encrypt backup files for security
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => backup.updateConfig({ encryptBackups: !backup.config.encryptBackups })}
            >
              {backup.config.encryptBackups ? 'Disable' : 'Enable'}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => backup.deleteOldBackups()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Old Backups
            </Button>
            <Button
              variant="outline"
              onClick={handleVerifyAll}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify All Backups
            </Button>
            <Button
              variant="outline"
              onClick={() => backup.loadBackups()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh List
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Backup History</CardTitle>
              <CardDescription>
                {backup.backups.length} backups available
              </CardDescription>
            </div>
            <Badge variant={backup.backupHealth.corrupted > 0 ? "destructive" : "success"}>
              {backup.backupHealth.corrupted > 0 
                ? `${backup.backupHealth.corrupted} corrupted` 
                : 'All healthy'
              }
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {backup.isCreatingBackup && (
            <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <span className="font-medium">Creating backup...</span>
                </div>
                <span className="text-sm text-muted-foreground">Just now</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
          )}

          {backup.isRestoring && (
            <div className="mb-4 p-4 rounded-lg bg-status-completed/5 border border-status-completed/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-status-completed" />
                  <span className="font-medium">Restoring backup...</span>
                </div>
                <span className="text-sm font-medium">{backup.verificationProgress}%</span>
              </div>
              <Progress value={backup.verificationProgress} className="h-2" />
            </div>
          )}

          {backup.backups.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No backups yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first backup to protect your data
              </p>
              <Button onClick={handleCreateBackup}>
                Create First Backup
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {backup.backups.map((b) => (
                <div
                  key={b.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    b.isCorrupted 
                      ? "bg-destructive/5 border-destructive/20"
                      : "bg-card"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center",
                      b.isCorrupted 
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    )}>
                      {b.isCorrupted ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        <Database className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Backup from {backup.formatDate(b.timestamp)}</p>
                        {b.isCorrupted && (
                          <Badge variant="destructive">Corrupted</Badge>
                        )}
                        {b.id === backup.latestBackup?.id && (
                          <Badge variant="success">Latest</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {backup.formatDate(b.timestamp)}
                        </span>
                        <span>•</span>
                        <span>{backup.formatFileSize(b.size)}</span>
                        <span>•</span>
                        <span>Version {b.version}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!b.isCorrupted && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreBackup(b.id)}
                          disabled={backup.isRestoring || restoringBackupId === b.id}
                        >
                          {restoringBackupId === b.id ? 'Restoring...' : 'Restore'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => backup.exportBackup(b.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => backup.verifyBackup(b.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBackup(b.id)}
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

      {/* Cloud Sync Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Cloud Sync</CardTitle>
          <CardDescription>
            Sync your backups to cloud storage for extra protection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                <span className="font-medium">Cloud Backup</span>
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatic cloud backup integration will be available in a future update.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Export Options</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Export backups as JSON, CSV, or PDF
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Encryption</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Military-grade encryption for all backups
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Version History</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Keep 30 days of backup history
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}