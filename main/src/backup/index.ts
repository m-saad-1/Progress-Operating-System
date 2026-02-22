import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { getDatabase } from '../database';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// All tables that hold user data (order matters for FK constraints on restore)
const BACKUP_TABLES = [
  'goals',
  'projects',
  'tasks',
  'checklist_items',
  'habits',
  'habit_completions',
  'notes',
  'time_blocks',
  'reviews',
  'audit_log',
  'sync_state',
] as const;

const REQUIRED_TABLES: ReadonlyArray<(typeof BACKUP_TABLES)[number]> = [
  'goals',
  'projects',
  'tasks',
  'checklist_items',
  'habits',
  'habit_completions',
  'notes',
  'time_blocks',
  'reviews',
];

const BACKUP_EXTENSION = '.backup';

function sha256Hex(input: Buffer | string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, any>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export interface BackupMetadata {
  id: string;
  timestamp: string;
  version: number;
  appVersion: string;
  compressed: boolean;
  checksum: string; // Deterministic payload checksum (NOT file checksum)
  tables: Record<string, number>; // table -> row count
}

export interface BackupRecord {
  id: string;
  path: string;
  timestamp: string;
  size: number;
  checksum: string;
  version: number;
  // Computed fields added at list time
  exists?: boolean;
  sizeFormatted?: string;
  dateFormatted?: string;
  metadata?: BackupMetadata;
}

export class BackupManager {
  private backupDir: string;
  private maxBackups: number;

  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.maxBackups = 50;
    this.ensureBackupDir();
  }

  private ensureBackupDir(): void {
    fs.ensureDirSync(this.backupDir);
  }

  private backupPathForId(backupId: string): string {
    return path.join(this.backupDir, `${backupId}${BACKUP_EXTENSION}`);
  }

  private async readAndParseBackupFile(backupPath: string): Promise<{ metadata: BackupMetadata; data: Record<string, any[]>; raw: Buffer }> {
    const raw = await fs.readFile(backupPath);

    // Decompress (or fallback to legacy uncompressed)
    let payload: string;
    try {
      const decompressed = await gunzip(raw);
      payload = decompressed.toString('utf-8');
    } catch {
      payload = raw.toString('utf-8');
    }

    const parsed = JSON.parse(payload);
    if (!isRecord(parsed) || !isRecord(parsed.metadata) || !isRecord(parsed.data)) {
      throw new Error('Invalid backup structure');
    }

    const metadata = parsed.metadata as BackupMetadata;
    const data = parsed.data as Record<string, any[]>;

    if (!metadata.id || !metadata.timestamp || !metadata.version) {
      throw new Error('Invalid backup metadata');
    }

    return { metadata, data, raw };
  }

  private computePayloadChecksum(metadata: Omit<BackupMetadata, 'checksum'>, data: Record<string, any[]>): string {
    return sha256Hex(stableStringify({ metadata, data }));
  }

  private async resolveBackupPath(backupId: string): Promise<string> {
    const direct = this.backupPathForId(backupId);
    if (await fs.pathExists(direct)) return direct;

    // Fallback: scan directory (handles rare cases like imported files with mismatched names)
    const entries = await fs.readdir(this.backupDir);
    for (const name of entries) {
      if (!name.endsWith(BACKUP_EXTENSION)) continue;
      const candidate = path.join(this.backupDir, name);
      try {
        const { metadata } = await this.readAndParseBackupFile(candidate);
        if (metadata.id === backupId) return candidate;
      } catch {
        // ignore broken file
      }
    }

    throw new Error('Backup file not found');
  }

  // ────────────────────── CREATE ──────────────────────

  async createBackup(): Promise<BackupRecord> {
    const db = getDatabase();
    const backupId = crypto.randomUUID();
    const backupPath = this.backupPathForId(backupId);

    // Gather every table's data (including soft-deleted rows so restore is complete)
    const tableCounts: Record<string, number> = {};
    const data: Record<string, any[]> = {};

    for (const table of BACKUP_TABLES) {
      try {
        const rows = db.executeQuery(`SELECT * FROM ${table}`);
        data[table] = rows;
        tableCounts[table] = rows.length;
      } catch {
        // Table might not exist yet (e.g. reviews before migration)
        data[table] = [];
        tableCounts[table] = 0;
      }
    }

    const metadataWithoutChecksum: Omit<BackupMetadata, 'checksum'> = {
      id: backupId,
      timestamp: new Date().toISOString(),
      version: 3,
      appVersion: app.getVersion(),
      compressed: true,
      tables: tableCounts,
    };

    const checksum = this.computePayloadChecksum(metadataWithoutChecksum, data);

    const metadata: BackupMetadata = {
      ...metadataWithoutChecksum,
      checksum,
    };

    const payload = stableStringify({ metadata, data });

    // Compress with gzip
    const compressed = await gzip(Buffer.from(payload, 'utf-8'));

    // Write to disk
    await fs.writeFile(backupPath, compressed);

    // Verify the file was written properly
    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      await fs.remove(backupPath);
      throw new Error('Backup file is empty after write');
    }

    await this.cleanupOldBackups();

    console.log(
      `Backup created: ${backupId} (${this.formatFileSize(stats.size)}, ${Object.values(tableCounts).reduce((a, b) => a + b, 0)} rows)`
    );

    return {
      id: backupId,
      path: backupPath,
      timestamp: metadata.timestamp,
      size: stats.size,
      checksum,
      version: metadata.version,
      exists: true,
      sizeFormatted: this.formatFileSize(stats.size),
      dateFormatted: new Date(metadata.timestamp).toLocaleString(),
      metadata,
    };
  }

  // ────────────────────── RESTORE ──────────────────────

  async restoreFromBackup(backupId: string): Promise<boolean> {
    const db = getDatabase();

    const backupPath = await this.resolveBackupPath(backupId);
    const { metadata, data } = await this.readAndParseBackupFile(backupPath);

    // Validate integrity (deterministic payload checksum)
    const { checksum, ...metadataCore } = metadata as any;
    const expected = String(checksum || '');
    const actual = this.computePayloadChecksum(metadataCore, data);
    // Backward compatibility: older backups may not have a checksum field.
    if (expected) {
      if (expected !== actual) {
        throw new Error('Backup integrity check failed (checksum mismatch)');
      }
    }

    // Validate required tables present (unless not part of this app build)
    for (const t of REQUIRED_TABLES) {
      if (!(t in data)) {
        throw new Error(`Backup is missing required table: ${t}`);
      }
    }

    // Determine which of the known tables exist in the DB
    const existingTables = new Set(
      db.executeQuery<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      ).map((r) => r.name)
    );

    // All-or-nothing restore
    const restoreTables = BACKUP_TABLES.filter((t) => existingTables.has(t));
    if (restoreTables.length === 0) {
      throw new Error('No restoreable tables exist in the current database');
    }

    db.runAtomic(() => {
      // Clear (reverse order to respect FK constraints)
      for (const table of [...restoreTables].reverse()) {
        db.executeQuery(`DELETE FROM ${table}`);
      }

      // Insert (forward order)
      for (const table of restoreTables) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const first = rows[0];
        if (!isRecord(first)) {
          throw new Error(`Invalid row format in table ${table}`);
        }

        const columns = Object.keys(first);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

        for (const row of rows) {
          if (!isRecord(row)) {
            throw new Error(`Invalid row format in table ${table}`);
          }
          const values = columns.map((col) => (row as any)[col]);
          db.executeQuery(insertSql, values);
        }

        // Post-verify counts match exactly
        const expectedCount = metadata.tables?.[table] ?? rows.length;
        const [{ count }] = db.executeQuery<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        if (Number(count) !== Number(expectedCount)) {
          throw new Error(`Restore verification failed for ${table}: expected ${expectedCount}, got ${count}`);
        }
      }
    });

    console.log(`Backup restored: ${backupId}`);
    return true;
  }

  // ────────────────────── VERIFY ──────────────────────

  async verifyBackup(backupId: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const backupPath = await this.resolveBackupPath(backupId);
      if (!(await fs.pathExists(backupPath))) return { valid: false, error: 'Backup file missing' };

      const { metadata, data } = await this.readAndParseBackupFile(backupPath);
      const { checksum, ...metadataCore } = metadata as any;
      const expected = String(checksum || '');
      const actual = this.computePayloadChecksum(metadataCore, data);
      // If checksum exists, enforce it. If missing (legacy), accept structure validation.
      if (expected && expected !== actual) return { valid: false, error: 'Checksum mismatch' };

      if (!metadata.tables || typeof metadata.tables !== 'object') {
        return { valid: false, error: 'Missing table counts' };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err?.message || String(err) };
    }
  }

  // ────────────────────── LIST ──────────────────────

  async getBackupList(): Promise<BackupRecord[]> {
    const entries = await fs.readdir(this.backupDir);
    const backups: BackupRecord[] = [];

    for (const name of entries) {
      if (!name.endsWith(BACKUP_EXTENSION)) continue;
      const fullPath = path.join(this.backupDir, name);
      const exists = await fs.pathExists(fullPath);
      if (!exists) continue;

      try {
        const stats = await fs.stat(fullPath);
        const { metadata } = await this.readAndParseBackupFile(fullPath);
        backups.push({
          id: metadata.id,
          path: fullPath,
          timestamp: metadata.timestamp,
          size: stats.size,
          checksum: metadata.checksum,
          version: metadata.version,
          exists: true,
          sizeFormatted: this.formatFileSize(stats.size),
          dateFormatted: new Date(metadata.timestamp).toLocaleString(),
          metadata,
        });
      } catch {
        // Broken file: still show as missing/invalid? keep minimal entry
        const stats = await fs.stat(fullPath);
        const id = name.replace(BACKUP_EXTENSION, '');
        backups.push({
          id,
          path: fullPath,
          timestamp: new Date(stats.mtimeMs).toISOString(),
          size: stats.size,
          checksum: '',
          version: 0,
          exists: true,
          sizeFormatted: this.formatFileSize(stats.size),
          dateFormatted: new Date(stats.mtimeMs).toLocaleString(),
        });
      }
    }

    backups.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return backups;
  }

  // ────────────────────── DELETE ──────────────────────

  async deleteBackup(backupId: string): Promise<boolean> {
    const backupPath = await this.resolveBackupPath(backupId);
    if (await fs.pathExists(backupPath)) {
      await fs.remove(backupPath);
    }
    console.log(`Backup deleted: ${backupId}`);
    return true;
  }

  // ────────────────────── STATS ──────────────────────

  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    totalSizeFormatted: string;
    oldestBackup: string | null;
    newestBackup: string | null;
    healthyBackups: number;
    missingBackups: number;
  }> {
    const backups = await this.getBackupList();
    const totalSize = backups.reduce((s, b) => s + (b.size || 0), 0);
    const healthy = backups.filter((b) => b.exists).length;
    const missing = backups.filter((b) => !b.exists).length;

    return {
      totalBackups: backups.length,
      totalSize,
      totalSizeFormatted: this.formatFileSize(totalSize),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null,
      healthyBackups: healthy,
      missingBackups: missing,
    };
  }

  // ────────────────────── EXPORT TO FILE ──────────────────────

  async exportBackupToFile(
    backupId: string,
    mainWindow: BrowserWindow
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    let backupPath: string;
    try {
      backupPath = await this.resolveBackupPath(backupId);
    } catch {
      return { success: false, error: 'Backup not found' };
    }

    if (!(await fs.pathExists(backupPath))) return { success: false, error: 'Backup file missing' };

    const { metadata, data } = await this.readAndParseBackupFile(backupPath);

    const ts = new Date(metadata.timestamp)
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Backup',
      defaultPath: `PersonalOS-Backup-${ts}.json`,
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    });

    if (canceled || !filePath) return { success: false, error: 'Export cancelled' };

    await fs.writeFile(filePath, JSON.stringify({ metadata, data }, null, 2), 'utf-8');

    console.log(`Backup exported: ${backupId} → ${filePath}`);
    return { success: true, path: filePath };
  }

  // ────────────────────── IMPORT FROM FILE ──────────────────────

  async importBackupFromFile(
    mainWindow: BrowserWindow
  ): Promise<{ success: boolean; backupId?: string; error?: string }> {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Backup',
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (canceled || filePaths.length === 0) return { success: false, error: 'Import cancelled' };

    const fileContent = await fs.readFile(filePaths[0], 'utf-8');
    let parsed: any;

    try {
      parsed = JSON.parse(fileContent);
    } catch {
      return { success: false, error: 'Invalid JSON file' };
    }

    if (!parsed.metadata || !parsed.data) {
      return { success: false, error: 'Not a valid PersonalOS backup file' };
    }

    if (!isRecord(parsed.metadata) || !isRecord(parsed.data)) {
      return { success: false, error: 'Invalid backup structure' };
    }

    // Save as a regular backup (new id, recomputed checksum)
    const backupId = crypto.randomUUID();
    const backupPath = this.backupPathForId(backupId);

    parsed.metadata.id = backupId;
    const metadataInput = parsed.metadata as any;
    const dataInput = parsed.data as any;

    // Ensure metadata fields exist
    const metadataWithoutChecksum: Omit<BackupMetadata, 'checksum'> = {
      id: String(metadataInput.id || backupId),
      timestamp: String(metadataInput.timestamp || new Date().toISOString()),
      version: Number(metadataInput.version || 3),
      appVersion: String(metadataInput.appVersion || app.getVersion()),
      compressed: true,
      tables: isRecord(metadataInput.tables) ? (metadataInput.tables as Record<string, number>) : {},
    };

    const checksum = this.computePayloadChecksum(metadataWithoutChecksum, dataInput);
    const metadata: BackupMetadata = { ...metadataWithoutChecksum, checksum };
    const payloadStr = stableStringify({ metadata, data: dataInput });
    const compressed = await gzip(Buffer.from(payloadStr, 'utf-8'));

    await fs.writeFile(backupPath, compressed);

    await fs.stat(backupPath);

    console.log(`Backup imported: ${backupId} from ${filePaths[0]}`);
    return { success: true, backupId };
  }

  // ────────────────────── CLEANUP ──────────────────────

  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.getBackupList();
    if (backups.length <= this.maxBackups) return;

    for (const backup of backups.slice(this.maxBackups)) {
      try {
        if (await fs.pathExists(backup.path)) {
          await fs.remove(backup.path);
        }
        console.log(`Cleaned up old backup: ${backup.id}`);
      } catch (err) {
        console.error(`Failed to clean up backup ${backup.id}:`, err);
      }
    }
  }

  // ────────────────────── UTILITIES ──────────────────────

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }
}

// ────────────────────── SINGLETON ──────────────────────

let backupManager: BackupManager | null = null;

export function getBackupManager(): BackupManager {
  if (!backupManager) {
    backupManager = new BackupManager();
  }
  return backupManager;
}

// ────────────────────── AUTO-BACKUP SCHEDULER ──────────────────────

export async function setupBackupSystem(): Promise<void> {
  const manager = getBackupManager();

  // Create initial backup if none exists
  // NOTE: Do not auto-restore. Backups are created automatically, but restoring is always explicit.
  const backups = await manager.getBackupList();
  if (backups.length === 0) {
    try {
      await manager.createBackup();
      console.log('Initial backup created');
    } catch (err) {
      console.error('Initial backup failed:', err);
    }
  }

  // Schedule automatic backups every 6 hours
  setInterval(async () => {
    try {
      await manager.createBackup();
      console.log('Scheduled backup completed');
    } catch (err) {
      console.error('Scheduled backup failed:', err);
    }
  }, 6 * 60 * 60 * 1000);
}

// ────────────────────── IPC REGISTRATION ──────────────────────

export function initializeBackupManager(mainWindow: BrowserWindow) {
  const manager = getBackupManager();

  // Create backup
  ipcMain.handle('backup:create', async () => {
    try {
      const record = await manager.createBackup();
      mainWindow.webContents.send('backup:created', record);
      return { success: true, data: record };
    } catch (error: any) {
      console.error('backup:create failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Restore backup
  ipcMain.handle('backup:restore', async (_event, backupId: string) => {
    try {
      await manager.restoreFromBackup(backupId);
      return { success: true };
    } catch (error: any) {
      console.error('backup:restore failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // List backups
  ipcMain.handle('backup:list', async () => {
    try {
      const backups = await manager.getBackupList();
      return { success: true, data: backups };
    } catch (error: any) {
      console.error('backup:list failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Delete backup
  ipcMain.handle('backup:delete', async (_event, backupId: string) => {
    try {
      await manager.deleteBackup(backupId);
      return { success: true };
    } catch (error: any) {
      console.error('backup:delete failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Verify backup
  ipcMain.handle('backup:verify', async (_event, backupId: string) => {
    try {
      const result = await manager.verifyBackup(backupId);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('backup:verify failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Get stats
  ipcMain.handle('backup:stats', async () => {
    try {
      const stats = await manager.getBackupStats();
      return { success: true, data: stats };
    } catch (error: any) {
      console.error('backup:stats failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Export backup to user-chosen file
  ipcMain.handle('backup:export', async (_event, backupId: string) => {
    try {
      const result = await manager.exportBackupToFile(backupId, mainWindow);
      return result;
    } catch (error: any) {
      console.error('backup:export failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Import backup from user-chosen file
  ipcMain.handle('backup:import', async () => {
    try {
      const result = await manager.importBackupFromFile(mainWindow);
      if (result.success) {
        const backups = await manager.getBackupList();
        const imported = backups.find((b) => b.id === result.backupId);
        if (imported) mainWindow.webContents.send('backup:created', imported);
      }
      return result;
    } catch (error: any) {
      console.error('backup:import failed:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Setup auto-backup schedule
  setupBackupSystem().catch(console.error);
}
