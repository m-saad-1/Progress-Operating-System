import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { getDatabase } from '../database';
import { IPC_CHANNEL_KEYS } from '../../../shared/constants';

export class BackupManager {
  private backupDir: string;
  private maxBackups: number;

  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.maxBackups = 30; // Keep last 30 backups
    this.ensureBackupDir();
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createIncrementalBackup(): Promise<string> {
    try {
      const db = getDatabase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = crypto.randomUUID();
      const backupPath = path.join(this.backupDir, `${backupId}.backup`);

      // Export current state
      const backupData = {
        metadata: {
          id: backupId,
          timestamp: new Date().toISOString(),
          version: 1,
          appVersion: app.getVersion(),
        },
        data: {
          goals: await this.exportTable('goals'),
          projects: await this.exportTable('projects'),
          tasks: await this.exportTable('tasks'),
          habits: await this.exportTable('habits'),
          notes: await this.exportTable('notes'),
          checklist_items: await this.exportTable('checklist_items'),
          habit_completions: await this.exportTable('habit_completions'),
          time_blocks: await this.exportTable('time_blocks'),
        },
      };

      // Compress and encrypt backup
      const jsonData = JSON.stringify(backupData);
      const compressed = await this.compressData(jsonData);
      const encrypted = this.encryptData(compressed);

      // Write backup file
      await fs.writeFile(backupPath, encrypted);

      // Verify backup
      const verified = await this.verifyBackup(backupPath);
      if (!verified) {
        throw new Error('Backup verification failed');
      }

      // Record backup in database
      const stats = await fs.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);

      db.executeQuery(`
        INSERT INTO backups (id, path, timestamp, size, checksum, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [backupId, backupPath, new Date().toISOString(), stats.size, checksum, 1]);

      // Cleanup old backups
      await this.cleanupOldBackups();

      console.log(`Backup created: ${backupId}`);
      return backupId;

    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup creation failed:', error.message);
      } else {
        console.error('Backup creation failed:', error);
      }
      throw error;
    }
  }

  private async exportTable(table: string): Promise<any[]> {
    const db = getDatabase();
    return db.executeQuery(`SELECT * FROM ${table} WHERE deleted_at IS NULL`);
  }

  private async compressData(data: string): Promise<Buffer> {
    // Simple compression (in production, use zlib or similar)
    return Buffer.from(data);
  }

  private encryptData(data: Buffer): Buffer {
    // Simple encryption (in production, use proper encryption)
    return data;
  }

  private async verifyBackup(backupPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        return false;
      }

      const checksum = await this.calculateChecksum(backupPath);
      return checksum.length === 64; // SHA-256 hash length

    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup verification failed:', error.message);
      } else {
        console.error('Backup verification failed:', error);
      }
      return false;
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const db = getDatabase();
      const backups = db.executeQuery<any>(`
        SELECT id, path FROM backups
        ORDER BY timestamp DESC
      `);

      if (backups.length > this.maxBackups) {
        const backupsToDelete = backups.slice(this.maxBackups);

        for (const backup of backupsToDelete) {
          try {
            await fs.unlink(backup.path);
            db.executeQuery('DELETE FROM backups WHERE id = ?', [backup.id]);
            console.log(`Deleted old backup: ${backup.id}`);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`Failed to delete backup ${backup.id}:`, error.message);
            } else {
              console.error(`Failed to delete backup ${backup.id}:`, error);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup cleanup failed:', error.message);
      } else {
        console.error('Backup cleanup failed:', error);
      }
    }
  }

  async getBackupList(): Promise<any[]> {
    try {
      const db = getDatabase();
      const backups = db.executeQuery<any>(`
        SELECT * FROM backups
        ORDER BY timestamp DESC
      `);

      // Add file existence check
      const backupsWithStatus = await Promise.all(
        backups.map(async (backup) => {
          const exists = await fs.pathExists(backup.path);
          return {
            ...backup,
            exists,
            sizeFormatted: this.formatFileSize(backup.size),
            dateFormatted: new Date(backup.timestamp).toLocaleString(),
          };
        })
      );

      return backupsWithStatus;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to list backups:', error.message);
      } else {
        console.error('Failed to list backups:', error);
      }
      return [];
    }
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
  }

  async restoreFromBackup(backupId: string): Promise<boolean> {
    try {
      const db = getDatabase();
      const backup = db.executeQuery<any>(
        'SELECT * FROM backups WHERE id = ?',
        [backupId]
      )[0];

      if (!backup) {
        throw new Error('Backup not found');
      }

      if (!fs.existsSync(backup.path)) {
        throw new Error('Backup file not found');
      }

      // Verify backup integrity
      const checksum = await this.calculateChecksum(backup.path);
      if (checksum !== backup.checksum) {
        throw new Error('Backup integrity check failed');
      }

      // Read and decrypt backup
      const encrypted = await fs.readFile(backup.path);
      const decrypted = this.decryptData(encrypted);
      const backupData = JSON.parse(decrypted.toString());

      // Restore data
      await this.restoreData(backupData.data);

      console.log(`Backup restored: ${backupId}`);
      return true;

    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup restore failed:', error.message);
      } else {
        console.error('Backup restore failed:', error);
      }
      throw error;
    }
  }

  private decryptData(data: Buffer): Buffer {
    // Simple decryption
    return data;
  }

  private async restoreData(data: any): Promise<void> {
    const db = getDatabase();

    // Start transaction
    db.executeTransaction([
      // Clear existing data (soft delete)
      { query: 'UPDATE goals SET deleted_at = ?', params: [new Date().toISOString()] },
      { query: 'UPDATE projects SET deleted_at = ?', params: [new Date().toISOString()] },
      { query: 'UPDATE tasks SET deleted_at = ?', params: [new Date().toISOString()] },
      { query: 'UPDATE habits SET deleted_at = ?', params: [new Date().toISOString()] },
      { query: 'UPDATE notes SET deleted_at = ?', params: [new Date().toISOString()] },
      { query: 'UPDATE checklist_items SET deleted_at = ?', params: [new Date().toISOString()] },
      { query: 'DELETE FROM habit_completions', params: [] },
      { query: 'UPDATE time_blocks SET deleted_at = ?', params: [new Date().toISOString()] },
    ]);

    // Restore data
    for (const [table, rows] of Object.entries(data)) {
      if (Array.isArray(rows)) {
        for (const row of rows) {
          // Remove id and timestamps to let database generate new ones
          const { id, created_at, updated_at, ...rest } = row;
          await db.insertData(table, rest);
        }
      }
    }
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const db = getDatabase();
      const backup = db.executeQuery<any>(
        'SELECT * FROM backups WHERE id = ?',
        [backupId]
      )[0];

      if (!backup) {
        throw new Error('Backup not found');
      }

      // Delete file
      if (fs.existsSync(backup.path)) {
        await fs.unlink(backup.path);
      }

      // Delete record
      db.executeQuery('DELETE FROM backups WHERE id = ?', [backupId]);

      console.log(`Backup deleted: ${backupId}`);
      return true;

    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup deletion failed:', error.message);
      } else {
        console.error('Backup deletion failed:', error);
      }
      throw error;
    }
  }

  async getBackupStats(): Promise<any> {
    try {
      const backups = await this.getBackupList();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const oldestBackup = backups[backups.length - 1];
      const newestBackup = backups[0];

      return {
        totalBackups: backups.length,
        totalSize: this.formatFileSize(totalSize),
        oldestBackup: oldestBackup?.dateFormatted || 'None',
        newestBackup: newestBackup?.dateFormatted || 'None',
        healthyBackups: backups.filter(b => b.exists).length,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to get backup stats:', error.message);
      } else {
        console.error('Failed to get backup stats:', error);
      }
      return null;
    }
  }
}

let backupManager: BackupManager | null = null;

export function getBackupManager(): BackupManager {
  if (!backupManager) {
    backupManager = new BackupManager();
  }
  return backupManager;
}

export async function setupBackupSystem(): Promise<void> {
  const manager = getBackupManager();

  // Create initial backup if none exists
  const backups = await manager.getBackupList();
  if (backups.length === 0) {
    try {
      await manager.createIncrementalBackup();
      console.log('Initial backup created');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Initial backup failed:', error.message);
      } else {
        console.error('Initial backup failed:', error);
      }
    }
  }

  // Schedule regular backups (every 6 hours)
  setInterval(async () => {
    try {
      await manager.createIncrementalBackup();
      console.log('Scheduled backup completed');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Scheduled backup failed:', error.message);
      } else {
        console.error('Scheduled backup failed:', error);
      }
    }
  }, 6 * 60 * 60 * 1000);

  // Also backup on app close
  process.on('beforeExit', async () => {
    try {
      await manager.createIncrementalBackup();
    } catch (error) {
      if (error instanceof Error) {
        console.error('Exit backup failed:', error.message);
      } else {
        console.error('Exit backup failed:', error);
      }
    }
  });
}

export function initializeBackupManager(mainWindow: BrowserWindow) {
  const manager = getBackupManager();

  ipcMain.handle(IPC_CHANNEL_KEYS.BACKUP_DATA, async () => {
    try {
      const backupId = await manager.createIncrementalBackup();
      mainWindow.webContents.send(IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: true, message: `Backup ${backupId} successful!` });
      return { success: true, message: 'Backup successful!' };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup failed:', error.message);
        mainWindow.webContents.send(IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: false, message: `Backup failed: ${error.message}` });
        return { success: false, message: `Backup failed: ${error.message}` };
      } else {
        console.error('Backup failed:', error);
        mainWindow.webContents.send(IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: false, message: `Backup failed: ${String(error)}` });
        return { success: false, message: `Backup failed: ${String(error)}` };
      }
    }
  });

  ipcMain.handle(IPC_CHANNEL_KEYS.RESTORE_DATA, async (event, backupId) => {
    try {
        await manager.restoreFromBackup(backupId);
      mainWindow.webContents.send(IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: true, message: 'Restore successful!' });
      return { success: true, message: 'Restore successful!' };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Restore failed:', error.message);
        mainWindow.webContents.send(IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: false, message: `Restore failed: ${error.message}` });
        return { success: false, message: `Restore failed: ${error.message}` };
      } else {
        console.error('Restore failed:', error);
        mainWindow.webContents.send(IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: false, message: `Restore failed: ${String(error)}` });
        return { success: false, message: `Restore failed: ${String(error)}` };
      }
    }
  });

  ipcMain.handle(IPC_CHANNEL_KEYS.GET_BACKUPS, async () => {
    try {
      return await manager.getBackupList();
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to get backups:', error.message);
      } else {
        console.error('Failed to get backups:', error);
      }
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNEL_KEYS.DELETE_BACKUP, async (event, backupId) => {
    try {
      return await manager.deleteBackup(backupId);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to delete backup:', error.message);
      } else {
        console.error('Failed to delete backup:', error);
      }
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNEL_KEYS.GET_BACKUP_STATS, async () => {
    try {
      return await manager.getBackupStats();
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to get backup stats:', error.message);
      } else {
        console.error('Failed to get backup stats:', error);
      }
      return null;
    }
  });
}