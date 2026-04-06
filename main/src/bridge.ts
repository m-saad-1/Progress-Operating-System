/**
 * Optimized Renderer-side Bridge
 *
 * This replaces the monolithic preload script with a cleaner,
 * more modular approach that still maintains Tauri compatibility.
 *
 * Each feature module exports its own exposed API.
 */

import { contextBridge } from 'electron';

/**
 * Expose database API
 */
const databaseAPI = {
  executeQuery: (query: string, params?: any[]) =>
    (window as any).electronAPI?.executeQuery(query, params),
  executeTransaction: (operations: any[]) =>
    (window as any).electronAPI?.executeTransaction(operations),
  getData: (table: string, where?: Record<string, any>) =>
    (window as any).electronAPI?.getData(table, where),
  insertData: (table: string, data: Record<string, any>) =>
    (window as any).electronAPI?.insertData(table, data),
  updateData: (table: string, id: string, data: Record<string, any>) =>
    (window as any).electronAPI?.updateData(table, id, data),
  deleteData: (table: string, id: string, softDelete?: boolean) =>
    (window as any).electronAPI?.deleteData(table, id, softDelete),
};

/**
 * Expose file API
 */
const fileAPI = {
  openFile: (options: any) =>
    (window as any).electronAPI?.selectFile(options),
  saveFile: (options: any) =>
    (window as any).electronAPI?.saveFile(options),
  read: (path: string) =>
    (window as any).electronAPI?.invoke('file:read', { path }),
  write: (path: string, content: string) =>
    (window as any).electronAPI?.invoke('file:write', { path, content }),
  exists: (path: string) =>
    (window as any).electronAPI?.invoke('file:exists', { path }),
  delete: (path: string) =>
    (window as any).electronAPI?.invoke('file:delete', { path }),
};

/**
 * Expose notification API
 */
const notificationAPI = {
  show: (options: any) =>
    (window as any).electronAPI?.showNotification(options),
  isSupported: () =>
    (window as any).electronAPI?.invoke('notification:isSupported'),
};

/**
 * Expose window API
 */
const windowAPI = {
  minimize: () =>
    (window as any).electronAPI?.minimizeWindow?.(),
  maximize: () =>
    (window as any).electronAPI?.maximizeWindow?.(),
  close: () =>
    (window as any).electronAPI?.invoke('window:close'),
  isMaximized: () =>
    (window as any).electronAPI?.invoke('window:isMaximized'),
};

/**
 * Expose app API
 */
const appAPI = {
  getVersion: () =>
    (window as any).electronAPI?.getVersion(),
  getPlatform: () =>
    (window as any).electronAPI?.getPlatform(),
  getPath: (name: string) =>
    (window as any).electronAPI?.getAppPath(name),
  openExternal: (url: string) =>
    (window as any).electronAPI?.invoke('app:openExternal', { url }),
  relaunch: () =>
    (window as any).electronAPI?.relaunch(),
  quit: () =>
    (window as any).electronAPI?.invoke('app:quit'),
};

/**
 * Expose unified desktop API
 * This is the new recommended way to access desktop features
 */
const desktopAPI = {
  database: databaseAPI,
  file: fileAPI,
  notifications: notificationAPI,
  window: windowAPI,
  app: appAPI,

  // Generic invoke for custom handlers
  invoke: (channel: string, args?: any) =>
    (window as any).electronAPI?.invoke(channel, args),

  // Listen for events
  on: (channel: string, handler: (args: any) => void) => {
    (window as any).electronAPI?.on?.(channel, handler);
  },
};

// Expose both old (for backward compatibility) and new APIs
contextBridge.exposeInMainWorld('electronAPI', (window as any).electronAPI || {});
contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);

