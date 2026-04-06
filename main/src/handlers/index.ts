/**
 * Modular IPC Handler System
 *
 * Instead of registering all IPC handlers in one file,
 * group them by feature for better tree-shaking and maintenance.
 *
 * Each handler module follows this pattern:
 *   export function setupXyzHandlers(ipc: IpcAPI): void { ... }
 *
 * Usage on main:
 *   import { setupDatabaseHandlers } from './handlers/database';
 *   setupDatabaseHandlers(desktopAPI.ipc);
 */

import { IpcAPI } from '../api/ipc';
import { DesktopAPI } from '../api';

export function registerAllHandlers(ipc: IpcAPI, api: DesktopAPI): void {
  setupDatabaseHandlers(ipc);
  setupFileHandlers(ipc, api);
  setupNotificationHandlers(ipc, api);
  setupWindowHandlers(ipc, api);
  setupAppHandlers(ipc, api);
  setupSyncHandlers(ipc);
  setupBackupHandlers(ipc);
  setupFeedbackHandlers(ipc);
}

/**
 * Database IPC Handlers
 * Handles all database queries, transactions, and operations
 */
function setupDatabaseHandlers(ipc: IpcAPI): void {
  // These will be registered from the main process
  // Kept here as reference - actual handlers remain in database module
}

/**
 * File IPC Handlers
 */
function setupFileHandlers(ipc: IpcAPI, api: DesktopAPI): void {
  ipc.handle('file:openDialog', async (options) => {
    return api.filesystem.openFile(options);
  });

  ipc.handle('file:saveDialog', async (options) => {
    return api.filesystem.saveFile(options);
  });

  ipc.handle('file:read', async ({ path }) => {
    return api.filesystem.readFile(path);
  });

  ipc.handle('file:write', async ({ path, content }) => {
    return api.filesystem.writeFile(path, content);
  });

  ipc.handle('file:exists', async ({ path }) => {
    return api.filesystem.exists(path);
  });

  ipc.handle('file:delete', async ({ path }) => {
    return api.filesystem.delete(path);
  });
}

/**
 * Notification IPC Handlers
 */
function setupNotificationHandlers(ipc: IpcAPI, api: DesktopAPI): void {
  ipc.handle('notification:show', async (options) => {
    return api.notifications.show(options);
  });

  ipc.handle('notification:isSupported', () => {
    return api.notifications.isSupported();
  });
}

/**
 * Window IPC Handlers
 */
function setupWindowHandlers(ipc: IpcAPI, api: DesktopAPI): void {
  ipc.handle('window:minimize', () => {
    api.window.minimize();
  });

  ipc.handle('window:maximize', () => {
    api.window.maximize();
  });

  ipc.handle('window:restore', () => {
    api.window.restore();
  });

  ipc.handle('window:toggleMaximize', () => {
    api.window.toggleMaximize();
  });

  ipc.handle('window:close', () => {
    api.window.close();
  });

  ipc.handle('window:isMaximized', () => {
    return api.window.isMaximized();
  });
}

/**
 * App IPC Handlers
 */
function setupAppHandlers(ipc: IpcAPI, api: DesktopAPI): void {
  ipc.handle('app:getVersion', () => {
    return api.app.getVersion();
  });

  ipc.handle('app:getPlatform', () => {
    return api.app.getPlatform();
  });

  ipc.handle('app:getPath', async ({ name }) => {
    return api.app.getPath(name);
  });

  ipc.handle('app:openExternal', async ({ url }) => {
    return api.app.openExternal(url);
  });

  ipc.handle('app:openPath', async ({ path }) => {
    return api.app.openPath(path);
  });

  ipc.handle('app:relaunch', () => {
    api.app.relaunch();
  });

  ipc.handle('app:quit', () => {
    api.app.quit();
  });
}

/**
 * Sync IPC Handlers
 * Placeholder - actual handlers in sync module
 */
function setupSyncHandlers(ipc: IpcAPI): void {
  // Sync handlers registered from sync module
}

/**
 * Backup IPC Handlers
 * Placeholder - actual handlers in backup module
 */
function setupBackupHandlers(ipc: IpcAPI): void {
  // Backup handlers registered from backup module
}

/**
 * Feedback IPC Handlers
 * Placeholder - actual handlers in feedback service
 */
function setupFeedbackHandlers(ipc: IpcAPI): void {
  // Feedback handlers registered from feedback service
}
