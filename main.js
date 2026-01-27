const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'build/icon.ico')
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools unconditionally for debugging
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

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

// IPC Handlers for file operations
ipcMain.handle('save-data', async (event, data) => {
  try {
    const appDataPath = app.getPath('userData');
    const dataPath = path.join(appDataPath, 'progress-data.json');
    
    // Create backup before saving
    if (fs.existsSync(dataPath)) {
      const backupPath = path.join(appDataPath, 'backups', `backup-${Date.now()}.json`);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(dataPath, backupPath);
    }
    
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-data', async () => {
  try {
    const appDataPath = app.getPath('userData');
    const dataPath = path.join(appDataPath, 'progress-data.json');
    
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return { success: true, data };
    }
    
    return { success: true, data: createInitialData() };
  } catch (error) {
    console.error('Load error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-data', async (event, data) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Data',
      defaultPath: `progress-os-export-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { success: true, path: filePath };
    }
    
    return { success: false };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-data', async () => {
  try {
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Import Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    
    if (filePaths && filePaths.length > 0) {
      const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
      return { success: true, data };
    }
    
    return { success: false };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, error: error.message };
  }
});

function createInitialData() {
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    user: {
      name: 'User',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStart: 'monday',
      theme: 'dark'
    },
    goals: [],
    tasks: [],
    habits: [],
    notes: [],
    backups: []
  };
}