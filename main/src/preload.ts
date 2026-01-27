import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  executeQuery: (query: string, params?: any[]) => 
    ipcRenderer.invoke('database:execute', query, params),
  
  executeTransaction: (operations: Array<{query: string, params?: any[]}>) =>
    ipcRenderer.invoke('database:transaction', operations),
  
  getData: (table: string, where?: Record<string, any>) =>
    ipcRenderer.invoke('database:get', table, where),
  
  insertData: (table: string, data: Record<string, any>) =>
    ipcRenderer.invoke('database:insert', table, data),
  
  updateData: (table: string, id: string, data: Record<string, any>) =>
    ipcRenderer.invoke('database:update', table, id, data),
  
  deleteData: (table: string, id: string, softDelete: boolean = true) =>
    ipcRenderer.invoke('database:delete', table, id, softDelete),
  
  // Backup operations
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: (backupId: string) => ipcRenderer.invoke('backup:restore', backupId),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  deleteBackup: (backupId: string) => ipcRenderer.invoke('backup:delete', backupId),
  
  // Export operations
  exportData: (format: 'json' | 'csv' | 'pdf') => 
    ipcRenderer.invoke('export:data', format),
  
  importData: (data: string, format: 'json' | 'csv') =>
    ipcRenderer.invoke('import:data', data, format),
  
  // File operations
  selectFile: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  
  // System operations
  getAppPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  getPlatform: () => process.platform,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  
  // Sync operations
  syncStart: () => ipcRenderer.invoke('sync:start'),
  syncStop: () => ipcRenderer.invoke('sync:stop'),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  setSyncConfig: (config: any) => ipcRenderer.invoke('sync:setConfig', config),
  
  // Undo/Redo
  undo: () => ipcRenderer.invoke('undo'),
  redo: () => ipcRenderer.invoke('redo'),
  getUndoStack: () => ipcRenderer.invoke('undo:stack'),
  clearHistory: () => ipcRenderer.invoke('undo:clear'),
  
  // Window operations
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // Events
  onSyncUpdate: (callback: (event: IpcRendererEvent, status: any) => void) =>
    ipcRenderer.on('sync:update', callback),
  
  onBackupCreated: (callback: (event: IpcRendererEvent, backup: any) => void) =>
    ipcRenderer.on('backup:created', callback),
  
  onDatabaseError: (callback: (event: IpcRendererEvent, error: any) => void) =>
    ipcRenderer.on('database:error', callback),
  
  onAppUpdate: (callback: (event: IpcRendererEvent, update: any) => void) =>
    ipcRenderer.on('app:update', callback),
  
  onFirstRun: (callback: (event: IpcRendererEvent) => void) =>
    ipcRenderer.on('app:first-run', callback),
  
  onMenuAction: (callback: (event: IpcRendererEvent, action: string) => void) =>
    ipcRenderer.on('menu:action', callback),
  
  // Remove listeners
  removeSyncUpdate: (callback: (event: IpcRendererEvent, status: any) => void) =>
    ipcRenderer.removeListener('sync:update', callback),
  
  removeBackupCreated: (callback: (event: IpcRendererEvent, backup: any) => void) =>
    ipcRenderer.removeListener('backup:created', callback),
  
  removeDatabaseError: (callback: (event: IpcRendererEvent, error: any) => void) =>
    ipcRenderer.removeListener('database:error', callback),
});

// Expose versions for debugging
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

// Type declarations for TypeScript
declare global {
  interface Window {
    electronAPI: {
      // Database
      executeQuery: (query: string, params?: any[]) => Promise<any>;
      executeTransaction: (operations: Array<{query: string, params?: any[]}>) => Promise<any>;
      getData: (table: string, where?: Record<string, any>) => Promise<any>;
      insertData: (table: string, data: Record<string, any>) => Promise<any>;
      updateData: (table: string, id: string, data: Record<string, any>) => Promise<any>;
      deleteData: (table: string, id: string, softDelete?: boolean) => Promise<any>;
      
      // Backup
      createBackup: () => Promise<string>;
      restoreBackup: (backupId: string) => Promise<boolean>;
      listBackups: () => Promise<any[]>;
      deleteBackup: (backupId: string) => Promise<boolean>;
      
      // Export/Import
      exportData: (format: 'json' | 'csv' | 'pdf') => Promise<string>;
      importData: (data: string, format: 'json' | 'csv') => Promise<boolean>;
      
      // File operations
      selectFile: (options: any) => Promise<string | null>;
      saveFile: (options: any) => Promise<string | null>;
      showSaveDialog: (options: any) => Promise<string | null>;
      
      // System
      getAppPath: (name: string) => Promise<string>;
      getPlatform: () => string;
      getVersion: () => Promise<string>;
      relaunch: () => Promise<void>;
      
      // Sync
      syncStart: () => Promise<void>;
      syncStop: () => Promise<void>;
      getSyncStatus: () => Promise<any>;
      setSyncConfig: (config: any) => Promise<void>;
      
      // Undo/Redo
      undo: () => Promise<boolean>;
      redo: () => Promise<boolean>;
      getUndoStack: () => Promise<any>;
      clearHistory: () => Promise<void>;
      
      // Window
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      
      // Events
      onSyncUpdate: (callback: (event: IpcRendererEvent, status: any) => void) => void;
      onBackupCreated: (callback: (event: IpcRendererEvent, backup: any) => void) => void;
      onDatabaseError: (callback: (event: IpcRendererEvent, error: any) => void) => void;
      onAppUpdate: (callback: (event: IpcRendererEvent, update: any) => void) => void;
      onFirstRun: (callback: (event: IpcRendererEvent) => void) => void;
      onMenuAction: (callback: (event: IpcRendererEvent, action: string) => void) => void;
      
      removeSyncUpdate: (callback: (event: IpcRendererEvent, status: any) => void) => void;
      removeBackupCreated: (callback: (event: IpcRendererEvent, backup: any) => void) => void;
      removeDatabaseError: (callback: (event: IpcRendererEvent, error: any) => void) => void;
    };
    versions: {
      node: () => string;
      chrome: () => string;
      electron: () => string;
    };
  }
}