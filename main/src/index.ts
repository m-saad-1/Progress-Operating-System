import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

import { initializeIpcMain } from './ipc';
import { setupAutoUpdater } from './updater';
import { setupProtocol } from './protocol';

// IMPORTANT: move these into main/src or alias them in webpack
import { initializeBackupManager } from './backup';
import { initDatabase } from './database';

console.log('[MAIN] main/src/index.ts started');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#171717',
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
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
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*"
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
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
