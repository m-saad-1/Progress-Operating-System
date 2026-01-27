"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupManager = void 0;
exports.getBackupManager = getBackupManager;
exports.setupBackupSystem = setupBackupSystem;
exports.initializeBackupManager = initializeBackupManager;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../database");
const constants_1 = require("@shared/constants");
class BackupManager {
    backupDir;
    maxBackups;
    constructor() {
        this.backupDir = path_1.default.join(electron_1.app.getPath('userData'), 'backups');
        this.maxBackups = 30;
        this.ensureBackupDir();
    }
    ensureBackupDir() {
        if (!fs_extra_1.default.existsSync(this.backupDir)) {
            fs_extra_1.default.mkdirSync(this.backupDir, { recursive: true });
        }
    }
    async createIncrementalBackup() {
        try {
            const db = (0, database_1.getDatabase)();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupId = crypto_1.default.randomUUID();
            const backupPath = path_1.default.join(this.backupDir, `${backupId}.backup`);
            const backupData = {
                metadata: {
                    id: backupId,
                    timestamp: new Date().toISOString(),
                    version: 1,
                    appVersion: electron_1.app.getVersion(),
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
            const jsonData = JSON.stringify(backupData);
            const compressed = await this.compressData(jsonData);
            const encrypted = this.encryptData(compressed);
            await fs_extra_1.default.writeFile(backupPath, encrypted);
            const verified = await this.verifyBackup(backupPath);
            if (!verified) {
                throw new Error('Backup verification failed');
            }
            const stats = await fs_extra_1.default.stat(backupPath);
            const checksum = await this.calculateChecksum(backupPath);
            db.executeQuery(`
        INSERT INTO backups (id, path, timestamp, size, checksum, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [backupId, backupPath, new Date().toISOString(), stats.size, checksum, 1]);
            await this.cleanupOldBackups();
            console.log(`Backup created: ${backupId}`);
            return backupId;
        }
        catch (error) {
            console.error('Backup creation failed:', error);
            throw error;
        }
    }
    async exportTable(table) {
        const db = (0, database_1.getDatabase)();
        return db.executeQuery(`SELECT * FROM ${table} WHERE deleted_at IS NULL`);
    }
    async compressData(data) {
        return Buffer.from(data);
    }
    encryptData(data) {
        return data;
    }
    async verifyBackup(backupPath) {
        try {
            const stats = await fs_extra_1.default.stat(backupPath);
            if (stats.size === 0) {
                return false;
            }
            const checksum = await this.calculateChecksum(backupPath);
            return checksum.length === 64;
        }
        catch (error) {
            console.error('Backup verification failed:', error);
            return false;
        }
    }
    async calculateChecksum(filePath) {
        const fileBuffer = await fs_extra_1.default.readFile(filePath);
        return crypto_1.default.createHash('sha256').update(fileBuffer).digest('hex');
    }
    async cleanupOldBackups() {
        try {
            const db = (0, database_1.getDatabase)();
            const backups = db.executeQuery(`
        SELECT id, path FROM backups
        ORDER BY timestamp DESC
      `);
            if (backups.length > this.maxBackups) {
                const backupsToDelete = backups.slice(this.maxBackups);
                for (const backup of backupsToDelete) {
                    try {
                        await fs_extra_1.default.unlink(backup.path);
                        db.executeQuery('DELETE FROM backups WHERE id = ?', [backup.id]);
                        console.log(`Deleted old backup: ${backup.id}`);
                    }
                    catch (error) {
                        console.error(`Failed to delete backup ${backup.id}:`, error);
                    }
                }
            }
        }
        catch (error) {
            console.error('Backup cleanup failed:', error);
        }
    }
    async getBackupList() {
        try {
            const db = (0, database_1.getDatabase)();
            const backups = db.executeQuery(`
        SELECT * FROM backups
        ORDER BY timestamp DESC
      `);
            const backupsWithStatus = await Promise.all(backups.map(async (backup) => {
                const exists = await fs_extra_1.default.pathExists(backup.path);
                return {
                    ...backup,
                    exists,
                    sizeFormatted: this.formatFileSize(backup.size),
                    dateFormatted: new Date(backup.timestamp).toLocaleString(),
                };
            }));
            return backupsWithStatus;
        }
        catch (error) {
            console.error('Failed to list backups:', error);
            return [];
        }
    }
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0)
            return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
    }
    async restoreFromBackup(backupId) {
        try {
            const db = (0, database_1.getDatabase)();
            const backup = db.executeQuery('SELECT * FROM backups WHERE id = ?', [backupId])[0];
            if (!backup) {
                throw new Error('Backup not found');
            }
            if (!fs_extra_1.default.existsSync(backup.path)) {
                throw new Error('Backup file not found');
            }
            const checksum = await this.calculateChecksum(backup.path);
            if (checksum !== backup.checksum) {
                throw new Error('Backup integrity check failed');
            }
            const encrypted = await fs_extra_1.default.readFile(backup.path);
            const decrypted = this.decryptData(encrypted);
            const backupData = JSON.parse(decrypted.toString());
            await this.restoreData(backupData.data);
            console.log(`Backup restored: ${backupId}`);
            return true;
        }
        catch (error) {
            console.error('Backup restore failed:', error);
            throw error;
        }
    }
    decryptData(data) {
        return data;
    }
    async restoreData(data) {
        const db = (0, database_1.getDatabase)();
        db.executeTransaction([
            { query: 'UPDATE goals SET deleted_at = ?', params: [new Date().toISOString()] },
            { query: 'UPDATE projects SET deleted_at = ?', params: [new Date().toISOString()] },
            { query: 'UPDATE tasks SET deleted_at = ?', params: [new Date().toISOString()] },
            { query: 'UPDATE habits SET deleted_at = ?', params: [new Date().toISOString()] },
            { query: 'UPDATE notes SET deleted_at = ?', params: [new Date().toISOString()] },
            { query: 'UPDATE checklist_items SET deleted_at = ?', params: [new Date().toISOString()] },
            { query: 'DELETE FROM habit_completions', params: [] },
            { query: 'UPDATE time_blocks SET deleted_at = ?', params: [new Date().toISOString()] },
        ]);
        for (const [table, rows] of Object.entries(data)) {
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    const { id, created_at, updated_at, ...rest } = row;
                    await db.insertData(table, rest);
                }
            }
        }
    }
    async deleteBackup(backupId) {
        try {
            const db = (0, database_1.getDatabase)();
            const backup = db.executeQuery('SELECT * FROM backups WHERE id = ?', [backupId])[0];
            if (!backup) {
                throw new Error('Backup not found');
            }
            if (fs_extra_1.default.existsSync(backup.path)) {
                await fs_extra_1.default.unlink(backup.path);
            }
            db.executeQuery('DELETE FROM backups WHERE id = ?', [backupId]);
            console.log(`Backup deleted: ${backupId}`);
            return true;
        }
        catch (error) {
            console.error('Backup deletion failed:', error);
            throw error;
        }
    }
    async getBackupStats() {
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
        }
        catch (error) {
            console.error('Failed to get backup stats:', error);
            return null;
        }
    }
}
exports.BackupManager = BackupManager;
let backupManager = null;
function getBackupManager() {
    if (!backupManager) {
        backupManager = new BackupManager();
    }
    return backupManager;
}
async function setupBackupSystem() {
    const manager = getBackupManager();
    const backups = await manager.getBackupList();
    if (backups.length === 0) {
        try {
            await manager.createIncrementalBackup();
            console.log('Initial backup created');
        }
        catch (error) {
            console.error('Initial backup failed:', error);
        }
    }
    setInterval(async () => {
        try {
            await manager.createIncrementalBackup();
            console.log('Scheduled backup completed');
        }
        catch (error) {
            console.error('Scheduled backup failed:', error);
        }
    }, 6 * 60 * 60 * 1000);
    process.on('beforeExit', async () => {
        try {
            await manager.createIncrementalBackup();
        }
        catch (error) {
            console.error('Exit backup failed:', error);
        }
    });
}
function initializeBackupManager(mainWindow) {
    const manager = getBackupManager();
    electron_1.ipcMain.handle(constants_1.IPC_CHANNEL_KEYS.BACKUP_DATA, async () => {
        try {
            const backupId = await manager.createIncrementalBackup();
            mainWindow.webContents.send(constants_1.IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: true, message: `Backup ${backupId} successful!` });
            return { success: true, message: 'Backup successful!' };
        }
        catch (error) {
            console.error('Backup failed:', error);
            mainWindow.webContents.send(constants_1.IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: false, message: `Backup failed: ${error.message}` });
            return { success: false, message: `Backup failed: ${error.message}` };
        }
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNEL_KEYS.RESTORE_DATA, async (event, backupId) => {
        try {
            await manager.restoreFromBackup(backupId);
            mainWindow.webContents.send(constants_1.IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: true, message: 'Restore successful!' });
            return { success: true, message: 'Restore successful!' };
        }
        catch (error) {
            console.error('Restore failed:', error);
            mainWindow.webContents.send(constants_1.IPC_CHANNEL_KEYS.BACKUP_STATUS, { success: false, message: `Restore failed: ${error.message}` });
            return { success: false, message: `Restore failed: ${error.message}` };
        }
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNEL_KEYS.GET_BACKUPS, async () => {
        try {
            return await manager.getBackupList();
        }
        catch (error) {
            console.error('Failed to get backups:', error);
            return [];
        }
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNEL_KEYS.DELETE_BACKUP, async (event, backupId) => {
        try {
            return await manager.deleteBackup(backupId);
        }
        catch (error) {
            console.error('Failed to delete backup:', error);
            return false;
        }
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNEL_KEYS.GET_BACKUP_STATS, async () => {
        try {
            return await manager.getBackupStats();
        }
        catch (error) {
            console.error('Failed to get backup stats:', error);
            return null;
        }
    });
}
//# sourceMappingURL=index.js.map