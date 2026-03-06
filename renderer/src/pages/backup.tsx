import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Download,
  Upload,
  Database,
  Shield,
  History,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Trash2,
  RotateCcw,
  RefreshCw,
  HardDrive,
  Loader2,
} from 'lucide-react'
import { useBackup, type Backup } from '@/hooks/use-backup'
import { cn } from '@/lib/utils'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

const BACKUP_TIPS_SECTIONS = [
  {
    title: 'Backup Safety Basics',
    points: [
      'Create backups before major edits, imports, or restore operations.',
      'Keep multiple recent backup points so one corrupted file does not block recovery.',
      'Use verification status regularly to confirm files are healthy and readable.',
    ],
  },
  {
    title: 'Restore Behavior and Overwrite Risk',
    points: [
      'Restore replaces current local data state with the selected backup snapshot.',
      'Changes made after the backup date can be lost if not saved in a newer backup first.',
      'Always create a fresh backup right before restoring to preserve the current state as a rollback point.',
    ],
  },
  {
    title: 'Sync Interaction and Best Practices',
    points: [
      'If sync is active, restore intentionally and then confirm that the expected state is propagated.',
      'Avoid back-to-back restore operations without validating data first.',
      'Use export/import for migration scenarios; use restore for rollback and recovery scenarios.',
    ],
  },
  {
    title: 'Backup Storage Locations',
    points: [
      'Local backups are stored in your device\'s AppData directory: AppData\\Local\\PersonalOS\\backups (Windows) or ~/.PersonalOS/backups (Mac/Linux).',
      'Backup files are compressed with gzip to minimize storage space while maintaining data integrity.',
      'To manually access backups: Open file explorer, navigate to the backup folder, and locate the .json.gz files (each named with a timestamp).',
      'The folder also contains a manifest.json file that lists all backups and their metadata for verification.',
      'To restore a backup manually: Decompress the .gz file, review the JSON structure, and import it through the Import button if the app cannot automatically restore it.',
      'Browser/exported backups can be restored through the Import button—use this for moving data between devices or as a migration backup.',
      'Never manually edit backup files unless absolutely necessary; corrupted backups cannot be recovered and may require complete app reset.',
    ],
  },
] as const

export default function BackupPage() {
  const backup = useBackup()
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; backupId: string | null }>({
    open: false,
    backupId: null,
  })
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; backupId: string | null }>({
    open: false,
    backupId: null,
  })

  const handleCreateBackup = async () => {
    await backup.createBackup()
  }

  const confirmRestore = async () => {
    if (!restoreDialog.backupId) return
    const backupId = restoreDialog.backupId
    setRestoreDialog({ open: false, backupId: null })
    setRestoringBackupId(backupId)
    await backup.restoreBackup(backupId)
    setRestoringBackupId(null)
  }

  const confirmDelete = async () => {
    if (!deleteDialog.backupId) return
    const backupId = deleteDialog.backupId
    setDeleteDialog({ open: false, backupId: null })
    await backup.deleteBackup(backupId)
  }

  const handleVerifyAll = async () => {
    await backup.verifyAllBackups()
  }

  const handleImport = async () => {
    await backup.importBackup()
  }

  const getVerificationBadge = (b: Backup) => {
    if (b.verified === true) return <Badge variant="success" size="sm">Verified</Badge>
    if (b.verified === false) return <Badge variant="destructive" size="sm">Failed</Badge>
    if (b.exists === false) return <Badge variant="warning" size="sm">Missing</Badge>
    return null
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-3xl font-bold">Backup & Restore</h1>
            <ContextTipsDialog
              title="Backup & Restore Tips"
              description="Important guidance on safety, restore behavior, overwrite risk, and sync interactions."
              sections={BACKUP_TIPS_SECTIONS}
              triggerLabel="Open backup and restore tips"
            />
          </div>
          <p className="text-muted-foreground">
            Protect your data with automatic and manual backups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleImport} 
            disabled={backup.isImporting}
            className="border-none bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 shadow-sm hover:shadow-md transition-all"
          >
            {backup.isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Import
          </Button>
          <Button onClick={handleCreateBackup} disabled={backup.isCreatingBackup}>
            {backup.isCreatingBackup ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            Create Backup
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backup.stats.totalBackups}</div>
            <p className="text-xs text-muted-foreground">
              {backup.stats.healthyBackups} healthy
              {backup.stats.missingBackups > 0 && `, ${backup.stats.missingBackups} missing`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backup.stats.totalSizeFormatted}</div>
            <p className="text-xs text-muted-foreground">
              Compressed with gzip
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
              {backup.stats.newestBackup
                ? backup.formatDate(backup.stats.newestBackup)
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {backup.latestBackup
                ? backup.formatFileSize(backup.latestBackup.size)
                : 'No backups yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backup.verifiedCount}/{backup.stats.totalBackups}
            </div>
            <p className="text-xs text-muted-foreground">
              {backup.failedCount > 0
                ? `${backup.failedCount} failed verification`
                : 'All verified backups healthy'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyAll}
                disabled={backup.isVerifying || !backup.hasBackups}
                className="border-none bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 shadow-sm hover:shadow-md transition-all"
              >
                {backup.isVerifying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Verify All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => backup.refresh()}
                className="border-none bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 shadow-sm hover:shadow-md transition-all"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-sm text-muted-foreground">
                Auto-backup runs every 6 hours · Max 50 backups retained
              </p>
              <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                Backups stored in: <code className="px-1 py-0.5 rounded bg-muted text-xs">AppData/Local/PersonalOS/backups</code>
              </p>
            </div>
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
            {backup.hasBackups && (
              <Badge variant={backup.failedCount > 0 ? 'destructive' : backup.missingBackups.length > 0 ? 'warning' : 'success'}>
                {backup.failedCount > 0
                  ? `${backup.failedCount} failed`
                  : backup.missingBackups.length > 0
                    ? `${backup.missingBackups.length} missing`
                    : 'All healthy'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Creating indicator */}
          {backup.isCreatingBackup && (
            <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <span className="font-medium">Creating backup…</span>
              </div>
            </div>
          )}

          {/* Restoring indicator */}
          {backup.isRestoring && (
            <div className="mb-4 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <span className="font-medium">Restoring backup… App will reload shortly.</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {backup.backups.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No backups yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first backup to protect your data
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button onClick={handleCreateBackup}>Create First Backup</Button>
                <Button variant="outline" onClick={handleImport} className="border-none bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 shadow-sm hover:shadow-md transition-all"><Download className="mr-2 h-4 w-4" />Import Backup</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {backup.backups.map((b, index) => (
                <div
                  key={b.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border transition-colors',
                    b.exists === false
                      ? 'bg-destructive/5 border-destructive/20'
                      : b.verified === false
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-card hover:bg-accent/30'
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        b.exists === false
                          ? 'bg-destructive/10 text-destructive'
                          : b.verified === false
                            ? 'bg-amber-500/10 text-amber-500'
                            : b.verified === true
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-primary/10 text-primary'
                      )}
                    >
                      {b.exists === false ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : b.verified === false ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : b.verified === true ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Database className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">
                          {b.dateFormatted || backup.formatDate(b.timestamp)}
                        </p>
                        {index === 0 && <Badge variant="success" size="sm">Latest</Badge>}
                        {getVerificationBadge(b)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {backup.formatDate(b.timestamp)}
                        </span>
                        <span>{b.sizeFormatted || backup.formatFileSize(b.size)}</span>
                        <span>v{b.version}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    {b.exists !== false && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRestoreDialog({ open: true, backupId: b.id })}
                          disabled={backup.isRestoring || restoringBackupId === b.id}
                          className="border-none bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 shadow-sm hover:shadow-md transition-all"
                        >
                          {restoringBackupId === b.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Restore</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => backup.exportBackup(b.id)}
                          title="Export as JSON"
                          className="border-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-sm hover:shadow-md transition-all"
                        >
                          <Upload className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">Export</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => backup.verifyBackup(b.id)}
                          disabled={backup.isVerifying}
                          title="Verify integrity"
                          className="border-none bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 shadow-sm hover:shadow-md transition-all"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, backupId: b.id })}
                      className="text-white bg-red-600/90 hover:bg-red-700 border-none shadow-sm hover:shadow-md transition-all"
                      title="Delete backup"
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

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialog.open} onOpenChange={(open) => !open && setRestoreDialog({ open: false, backupId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace <strong>all current data</strong> with the data from this backup.
              The application will reload after the restore is complete. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>
              Restore Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, backupId: null })}>
        <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Backup?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this backup file from disk.
              <span className="block mt-2 font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-orange-500 hover:bg-orange-600">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}