import { app, BrowserWindow, Menu, Tray, shell } from 'electron';
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
if (process.platform === 'win32') {
  app.setAppUserModelId('com.progressos.app');
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function resolveRuntimeIconPath(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'build', process.platform === 'win32' ? 'POS-ICON.ico' : 'icon.png'),
    path.join(process.resourcesPath, 'build', 'icon.png'),
    path.join(__dirname, '..', '..', 'build', process.platform === 'win32' ? 'POS-ICON.ico' : 'icon.png'),
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray(): void {
  if (tray) return;

  const trayIconPath = resolveRuntimeIconPath();
  if (!trayIconPath) {
    console.warn('[MAIN] Tray icon not found. Skipping tray creation.');
    return;
  }

  tray = new Tray(trayIconPath);
  tray.setToolTip('Progress OS');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Progress OS',
      click: () => showMainWindow(),
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
}

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
  const iconPath = resolveRuntimeIconPath();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#171717',
    show: false,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.on('close', () => {
    // Closing the main window should terminate the desktop process.
    isQuitting = true;
  });

  // Set CSP for development only
  if (!app.isPackaged) {
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

  // Log console messages from renderer (in dev and production for debugging)
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const prefix = app.isPackaged ? '[RENDERER-PROD]' : '[RENDERER]';
    console.log(`${prefix} ${message}`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[MAIN] Renderer failed to load:', errorCode, errorDescription);
  });

  mainWindow.once('ready-to-show', () => {
    console.log('[MAIN] Window ready to show');
    mainWindow?.show();
    mainWindow?.maximize();

    // Only open DevTools in development (NOT in packaged/production builds)
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Add detailed renderer error logging
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[MAIN] Renderer process gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[MAIN] Renderer process is unresponsive');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Renderer finished loading');
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
    console.log('[MAIN] App is ready, initializing database...');
    await initDatabase();
    console.log('[MAIN] Database initialized, creating window...');
    createWindow();
    createTray();
    console.log('[MAIN] Window created successfully');
  } catch (err) {
    console.error('[MAIN] Failed to start app:', err);
    if (err instanceof Error) {
      console.error('[MAIN] Error stack:', err.stack);
    }
    // Show error dialog in production
    if (app.isPackaged) {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Initialization Error',
        `Failed to start Progress OS:\n\n${err instanceof Error ? err.message : String(err)}`
      );
    }
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (isQuitting) {
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
  isQuitting = true;
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
