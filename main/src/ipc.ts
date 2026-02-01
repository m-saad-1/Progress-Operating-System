import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { getDatabase } from './database';
import { getBackupManager } from './backup';
import { getSyncManager } from '../../sync';
import { getCommandManager } from '../../undo';
import { IPC_CHANNEL_KEYS } from '../../shared/constants';
// import { mainWindow } from './index'; // Remove this line

export function initializeIpcMain(mainWindow: BrowserWindow) { // Renamed and added mainWindow argument
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

  // Backup operations
  ipcMain.handle('backup:create', async () => {
    try {
      const backupManager = getBackupManager();
      const backupId = await backupManager.createIncrementalBackup();
      return { success: true, backupId };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup creation failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Backup creation failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('backup:restore', async (event, backupId: string) => {
    try {
      const backupManager = getBackupManager();
      const success = await backupManager.restoreFromBackup(backupId);
      return { success };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup restore failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Backup restore failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('backup:list', async () => {
    try {
      const backupManager = getBackupManager();
      const backups = await backupManager.getBackupList();
      return { success: true, backups };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup list failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Backup list failed:', error);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('backup:delete', async (event, backupId: string) => {
    try {
      const backupManager = getBackupManager();
      await backupManager.deleteBackup(backupId);
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        console.error('Backup delete failed:', error.message);
        return { success: false, error: error.message };
      } else {
        console.error('Backup delete failed:', error);
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

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  // Sync operations
  ipcMain.handle('sync:start', async () => {
    try {
      const syncManager = getSyncManager();
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
}