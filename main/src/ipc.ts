import { ipcMain, dialog, app, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { getDatabase } from './database';
import { getSyncManager } from '../../sync';
import { getCommandManager } from '../../undo';
import { IPC_CHANNEL_KEYS } from '../../shared/constants';
import {
  submitFeedback,
  retryFailedFeedbackQueue,
  getFeedbackQueueCount,
  verifyFeedbackConfig,
  initFeedbackAutoRetry,
} from './feedback-service';

export function initializeIpcMain(mainWindow: BrowserWindow) {
  const syncManager = getSyncManager()

  // Initialize feedback auto-retry (queued items from previous sessions)
  initFeedbackAutoRetry();

  const emitSyncUpdate = (payload: any) => {
    if (!mainWindow?.isDestroyed()) {
      mainWindow.webContents.send('sync:update', payload)
    }
  }

  syncManager.on('statusChange', (status: any) => {
    emitSyncUpdate({
      status: status.error ? 'error' : status.isSyncing ? 'syncing' : 'idle',
      error: status.error,
      progress: status.progress || 0,
      lastSync: status.lastSyncTime ? new Date(status.lastSyncTime).toISOString() : undefined,
    })
  })

  syncManager.on('syncComplete', (details: any) => {
    emitSyncUpdate({
      status: 'success',
      progress: 100,
      lastSync: details?.timestamp ? new Date(details.timestamp).toISOString() : new Date().toISOString(),
      stats: details?.stats || { uploaded: 0, downloaded: 0, conflicts: 0 },
    })
  })

  syncManager.on('error', (err: any) => {
    emitSyncUpdate({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
  })

  // Database operations
  ipcMain.handle('database:execute', async (event, query: string, params?: any[]) => {
    try {
      const db = getDatabase();
      const result = db.executeQuery(query, params);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Database query failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Database query failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('database:transaction', async (event, operations) => {
    try {
      const db = getDatabase();
      const result = db.executeTransaction(operations);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Transaction failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Transaction failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('database:get', async (event, table: string, where?: Record<string, any>) => {
    try {
      const db = getDatabase();
      const result = db.getData(table, where);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get data failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Get data failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('database:insert', async (event, table: string, data: Record<string, any>) => {
    try {
      const db = getDatabase();
      const result = db.insertData(table, data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Insert failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Insert failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('database:update', async (event, table: string, id: string, data: Record<string, any>) => {
    try {
      const db = getDatabase();
      const result = db.updateData(table, id, data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Update failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Update failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('database:delete', async (event, table: string, id: string, softDelete: boolean = true) => {
    try {
      const db = getDatabase();
      const result = db.deleteData(table, id, softDelete);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Delete failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Delete failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  // Export/Import operations
  ipcMain.handle('export:data', async (event, format: 'json' | 'csv' | 'pdf') => {
    try {
      const db = getDatabase();
      const data = db.exportData(format);
      
      const { filePath } = await dialog.showSaveDialog({
        title: 'Export Data',
        defaultPath: `progress-os-export-${new Date().toISOString().split('T')[0]}.${format}`,
        filters: [
          { name: format.toUpperCase(), extensions: [format] },
        ],
      });
      
      if (filePath) {
        await fs.writeFile(filePath, data);
        return { success: true, path: filePath };
      }
      
      return { success: false, error: 'Export cancelled' };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Export failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Export failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('import:data', async (event, data: string, format: 'json' | 'csv') => {
    try {
      const db = getDatabase();
      const result = await db.importData(data, format);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Import failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Import failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  // File operations
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'All Files', extensions: ['*'] },
      ],
      ...options,
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    const result = await dialog.showSaveDialog({
      ...options,
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePath;
  });

  ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
    const result = await dialog.showSaveDialog(options);
    return result.filePath;
  });

  // System operations
  ipcMain.handle('app:getPath', (event, name: string) => {
    return app.getPath(name as any);
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getIconPath', () => {
    // Return platform-specific icon path for notifications
    let iconFileName: string;
    
    if (process.platform === 'win32') {
      // Windows: use .ico format (or .png as fallback)
      iconFileName = 'icon.png'; // Windows notifications work better with PNG
    } else if (process.platform === 'darwin') {
      // macOS: use .png (icns is for app bundle)
      iconFileName = 'icon.png';
    } else {
      // Linux: use .png format
      iconFileName = 'icon.png';
    }
    
    const iconPath = path.join(__dirname, '..', '..', 'build', iconFileName);
    
    // Verify the icon exists and return absolute path
    if (fs.existsSync(iconPath)) {
      // Return as file:// URL for better cross-platform compatibility
      return `file://${iconPath.replace(/\\/g, '/')}`;
    }
    
    // Fallback to icon.png if platform-specific icon doesn't exist
    const fallbackPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
    if (fs.existsSync(fallbackPath)) {
      return `file://${fallbackPath.replace(/\\/g, '/')}`;
    }
    
    console.warn('[IPC] Notification icon not found at expected path');
    return undefined;
  });

  // Native notification with app icon
  ipcMain.handle('app:showNotification', (event, options: { title: string; body: string }) => {
    try {
      // Get the icon path for notifications
      const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
      
      // Create notification options
      const notificationOptions: any = {
        title: options.title,
        body: options.body,
        silent: false,
      };

      // Add icon if it exists
      // On Windows: this improves icon display in development mode
      // On macOS: the app icon is used automatically via the bundle
      // On Linux: this is required for the icon to display
      if (fs.existsSync(iconPath)) {
        notificationOptions.icon = nativeImage.createFromPath(iconPath);
      }

      // On Windows, ensure the app user model ID is set for proper notification display
      // This is already set in main/src/index.ts with app.setAppUserModelId('com.progressos.app')

      // Create and show the notification
      // Using Electron's native Notification ensures the app icon is displayed correctly
      const { Notification } = require('electron');
      const notification = new Notification(notificationOptions);
      notification.show();
      
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to show notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to show notification' 
      };
    }
  });

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  // Sync operations
  ipcMain.handle('sync:start', async () => {
    try {
      if (!syncManager.isEnabled()) {
        syncManager.enable();
      }
      await syncManager.start();
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Sync start failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Sync start failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('sync:stop', async () => {
    try {
      const syncManager = getSyncManager();
      await syncManager.stop();
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Sync stop failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Sync stop failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('sync:status', async () => {
    try {
      const syncManager = getSyncManager();
      return { success: true, status: syncManager.getStatus() };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Sync status failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Sync status failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('sync:setConfig', async (event, config) => {
    try {
      const syncManager = getSyncManager();
      syncManager.setConfig(config);
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Sync config failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Sync config failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  // Undo/Redo operations
  ipcMain.handle('undo', async () => {
    try {
      const commandManager = getCommandManager();
      const success = commandManager.undo();
      return { success };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Undo failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Undo failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('redo', async () => {
    try {
      const commandManager = getCommandManager();
      const success = commandManager.redo();
      return { success };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Redo failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Redo failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('undo:stack', async () => {
    try {
      const commandManager = getCommandManager();
      const history = commandManager.getHistory();
      return { success: true, history };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get undo stack failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Get undo stack failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('undo:clear', async () => {
    try {
      const commandManager = getCommandManager();
      commandManager.clear();
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Clear history failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Clear history failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  // Window operations
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // Menu actions
  ipcMain.on('menu:new-goal', () => {
    mainWindow?.webContents.send('menu:action', 'new-goal');
  });

  ipcMain.on('menu:new-task', () => {
    mainWindow?.webContents.send('menu:action', 'new-task');
  });

  ipcMain.on('menu:backup', () => {
    mainWindow?.webContents.send('menu:action', 'backup');
  });

  ipcMain.on('menu:export', () => {
    mainWindow?.webContents.send('menu:action', 'export');
  });

  ipcMain.on('menu:preferences', () => {
    mainWindow?.webContents.send('menu:action', 'preferences');
  });

  ipcMain.on('menu:about', () => {
    if (process.platform === 'darwin') {
      app.showAboutPanel();
    } else {
      mainWindow?.webContents.send('menu:action', 'about');
    }
  });

  // ============ REVIEW SYSTEM IPC HANDLERS ============
  
  ipcMain.handle('reviews:getAll', async (event, type?: string, limit?: number) => {
    try {
      const db = getDatabase();
      const reviews = db.getReviews(type, limit);
      return { success: true, data: reviews };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get reviews failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:getById', async (event, id: string) => {
    try {
      const db = getDatabase();
      const review = db.getReviewById(id);
      return { success: true, data: review };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get review failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:getLatest', async (event, type: string) => {
    try {
      const db = getDatabase();
      const review = db.getLatestReview(type);
      return { success: true, data: review };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get latest review failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:getForPeriod', async (event, type: string, periodStart: string, periodEnd: string) => {
    try {
      const db = getDatabase();
      const review = db.getReviewForPeriod(type, periodStart, periodEnd);
      return { success: true, data: review };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get review for period failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:create', async (event, data: any) => {
    try {
      const db = getDatabase();
      const review = db.createReview(data);
      return { success: true, data: review };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Create review failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:update', async (event, id: string, data: any) => {
    try {
      const db = getDatabase();
      const review = db.updateReview(id, data);
      return { success: true, data: review };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Update review failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:delete', async (event, id: string) => {
    try {
      const db = getDatabase();
      const success = db.deleteReview(id);
      return { success };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Delete review failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:getInsights', async (event, periodStart: string, periodEnd: string) => {
    try {
      const db = getDatabase();
      const insights = db.getReviewInsights(periodStart, periodEnd);
      return { success: true, data: insights };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get review insights failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('reviews:getHistory', async (event, type?: string, startDate?: string, endDate?: string) => {
    try {
      const db = getDatabase();
      const history = db.getReviewHistory(type, startDate, endDate);
      return { success: true, data: history };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Get review history failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  // Reset all application data
  ipcMain.handle('app:resetAllData', async () => {
    try {
      console.log('Starting complete application data reset...');
      
      const userData = app.getPath('userData');
      const dbPath = path.join(userData, 'progress.db');
      const dbShmPath = path.join(userData, 'progress.db-shm');
      const dbWalPath = path.join(userData, 'progress.db-wal');
      const syncConfigPath = path.join(userData, 'sync-config.json');
      const encryptionKeyPath = path.join(userData, 'encryption.key');
      const legacyJsonPath = path.join(userData, 'progress-data.json');
      const backupDir = path.join(userData, 'backups');

      // Clear Chromium session storage/caches (renderer localStorage is cleared in renderer code)
      try {
        await mainWindow.webContents.session.clearStorageData({
          storages: [
            'cookies',
            'filesystem',
            'indexdb',
            'localstorage',
            'shadercache',
            'serviceworkers',
            'cachestorage',
          ],
        });
        await mainWindow.webContents.session.clearCache();
      } catch (err) {
        console.warn('Reset: failed to clear session storage/cache (continuing):', err);
      }

      // Stop sync (best-effort) to prevent background writes during wipe
      try {
        const sync = getSyncManager();
        await sync.stop();
      } catch (err) {
        console.warn('Reset: failed to stop sync manager (continuing):', err);
      }
      
      // Close database connection before deletion
      const db = getDatabase();
      if (db && typeof db.close === 'function') {
        db.close();
      }
      
      // Delete database files
      const filesToDelete = [
        dbPath,
        dbShmPath,
        dbWalPath,
        syncConfigPath,
        encryptionKeyPath,
        legacyJsonPath,
      ];
      
      for (const filePath of filesToDelete) {
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          console.log(`Deleted: ${filePath}`);
        }
      }

      // Remove legacy SQLite backup snapshots produced by older/duplicate systems.
      // These are full DB copies and would cause "ghost data" after erase.
      try {
        if (await fs.pathExists(backupDir)) {
          const entries = await fs.readdir(backupDir);
          for (const name of entries) {
            if (name.startsWith('backup-') && name.endsWith('.db')) {
              await fs.remove(path.join(backupDir, name));
              console.log(`Deleted legacy DB backup: ${name}`);
            }
          }
        }
      } catch (err) {
        console.warn('Reset: failed to remove legacy .db backups (continuing):', err);
      }
      
      console.log('All application data has been reset successfully');
      
      // Wait a moment to ensure all file operations complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Relaunch the app to reinitialize with fresh state
      app.relaunch();
      app.exit(0);
      
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Reset all data failed:', error.message);
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  });

  // ─── Feedback via Nodemailer SMTP (main-process) ──────────────────────────────

  ipcMain.handle('feedback:submit', async (_event, payload) => {
    return submitFeedback(payload);
  });

  ipcMain.handle('feedback:retryFailed', async () => {
    try {
      const result = await retryFailedFeedbackQueue();
      return { success: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('feedback:queueCount', async () => {
    return getFeedbackQueueCount();
  });

  ipcMain.handle('feedback:verifyConfig', async () => {
    return verifyFeedbackConfig();
  });
}