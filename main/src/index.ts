import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';

import { initializeIpcMain } from './ipc';
import { setupAutoUpdater } from './updater';
import { setupProtocol } from './protocol';

// IMPORTANT: move these into main/src or alias them in webpack
import { initializeBackupManager } from './backup';
import { initDatabase, getDatabase } from './database';

console.log('[MAIN] main/src/index.ts started');

// Set app name for system notifications
app.setName('Progress OS');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;

function loadDotEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) continue;

      const key = line.slice(0, separatorIndex).trim();
      if (!key || process.env[key]) continue;

      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch (error) {
    console.warn('[MAIN] Failed to load .env file:', error);
  }
}

loadDotEnv();

function createWindow(): void {
  const iconPath = path.join(__dirname, '..', '..', 'build', 'POS-ICON.ico');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#171717',
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Set CSP for development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: file: http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*; connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*"
          ]
        }
      });
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    if (process.env.NODE_ENV === 'development') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  initializeIpcMain(mainWindow);
  setupAutoUpdater(mainWindow);
  setupProtocol(mainWindow);
  initializeBackupManager(mainWindow);
}

app.whenReady().then(async () => {
  try {
    await initDatabase();
    createWindow();
  } catch (err) {
    console.error('[MAIN] Failed to start app:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Close database with checkpoint before quitting
    try {
      const db = getDatabase();
      if (db) {
        db.close();
      }
    } catch (error) {
      console.error('Error closing database on app quit:', error);
    }
    app.quit();
  }
});

// Ensure database is checkpointed before quit  
app.on('before-quit', () => {
  try {
    const db = getDatabase();
    if (db) {
      db.close();
    }
  } catch (error) {
    console.error('Error closing database on before-quit:', error);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
