// @ts-ignore
import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';
// import { mainWindow } from './index'; // Remove this line

let updateAvailable = false;

export function setupAutoUpdater(mainWindow: BrowserWindow) { // Added mainWindow argument
  // Configure autoUpdater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Only check for updates in production
  if (process.env.NODE_ENV === 'production') {
    // Check for updates on startup (but not immediately)
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(console.error);
    }, 5000);
    
    // Check for updates every 6 hours
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(console.error);
    }, 6 * 60 * 60 * 1000);
  }
  
  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    mainWindow?.webContents.send('app:update', { type: 'checking' });
  });
  
  autoUpdater.on('update-available', (info: any) => {
    console.log('Update available:', info.version);
    updateAvailable = true;
    mainWindow?.webContents.send('app:update', {
      type: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
    
    // Show notification to user
    showUpdateNotification(mainWindow, info);
  });
  
  autoUpdater.on('update-not-available', (info: any) => {
    console.log('No updates available');
    mainWindow?.webContents.send('app:update', { type: 'not-available' });
  });
  
  autoUpdater.on('error', (err: any) => {
    console.error('Update error:', err);
    mainWindow?.webContents.send('app:update', {
      type: 'error',
      error: err.message,
    });
  });
  
  autoUpdater.on('download-progress', (progressObj: any) => {
    const percent = Math.floor(progressObj.percent);
    console.log(`Download progress: ${percent}%`);
    mainWindow?.webContents.send('app:update', {
      type: 'progress',
      percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });
  
  autoUpdater.on('update-downloaded', (info: any) => {
    console.log('Update downloaded:', info.version);
    mainWindow?.webContents.send('app:update', {
      type: 'downloaded',
      version: info.version,
    });
    
    // Prompt user to install update
    showUpdateReadyDialog(mainWindow, info);
  });
}

function showUpdateNotification(mainWindow: BrowserWindow, info: any) {
  if (!mainWindow) return;
  
  const buttons = ['Download Update', 'Later'];
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) of Progress OS is available.`,
    detail: 'Would you like to download and install it now?',
    buttons,
    defaultId: 0,
    cancelId: 1,
  }).then((result) => {
    if (result.response === 0) {
      // Download update
      autoUpdater.downloadUpdate().catch(console.error);
    }
  });
}

function showUpdateReadyDialog(mainWindow: BrowserWindow, info: any) {
  if (!mainWindow) return;
  
  const buttons = ['Restart and Install', 'Later'];
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Update to version ${info.version} has been downloaded.`,
    detail: 'The application will restart to install the update.',
    buttons,
    defaultId: 0,
    cancelId: 1,
  }).then((result) => {
    if (result.response === 0) {
      // Install and restart
      autoUpdater.quitAndInstall();
    }
  });
}

export function checkForUpdates() {
  if (process.env.NODE_ENV === 'production') {
    autoUpdater.checkForUpdates().catch(console.error);
  }
}

export function downloadUpdate() {
  if (updateAvailable) {
    autoUpdater.downloadUpdate().catch(console.error);
  }
}

export function getUpdateStatus() {
  return {
    updateAvailable,
    version: autoUpdater.currentVersion.version,
  };
}