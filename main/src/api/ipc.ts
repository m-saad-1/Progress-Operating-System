/**
 * IPC (Inter-Process Communication) API
 *
 * Abstracts the communication layer between renderer and main process.
 * Electron uses ipcRenderer/ipcMain, Tauri uses `invoke` commands.
 */

import { ipcMain, ipcRenderer, BrowserWindow } from 'electron';

export interface IpcHandler {
  (args: any): Promise<any> | any;
}

export class IpcAPI {
  private handlers: Map<string, IpcHandler> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Register a handler for a channel (main process)
   * Tauri equivalent: #[tauri::command]
   */
  handle(channel: string, handler: IpcHandler): void {
    this.handlers.set(channel, handler);
    // Only register with ipcMain if we're in the main process
    if (typeof ipcMain !== 'undefined') {
      ipcMain.handle(channel, async (event, args) => {
        try {
          return await handler(args);
        } catch (error) {
          console.error(`[IPC] Error handling ${channel}:`, error);
          throw error;
        }
      });
    }
  }

  /**
   * Emit event from main to renderer
   * Tauri equivalent: tauri::Window::emit
   */
  emit(channel: string, payload: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  /**
   * Listen for events from renderer (main process only)
   * Tauri equivalent: #[tauri::command] with listen
   */
  on(channel: string, handler: (args: any) => void): void {
    if (typeof ipcMain !== 'undefined') {
      ipcMain.on(channel, (event, args) => {
        handler(args);
      });
    }
  }

  /**
   * Invoke a handler from renderer process
   * Only available in renderer process - bridges to main
   */
  static async invoke(channel: string, args?: any): Promise<any> {
    if (typeof ipcRenderer !== 'undefined') {
      return ipcRenderer.invoke(channel, args);
    }
    throw new Error('Cannot invoke IPC from main process');
  }

  /**
   * Listen for events in renderer process
   * Only available in renderer process
   */
  static on(channel: string, handler: (args: any) => void): () => void {
    if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.on(channel, (event, args) => {
        handler(args);
      });

      // Return unsubscribe function
      return () => {
        if (typeof ipcRenderer !== 'undefined') {
          ipcRenderer.removeAllListeners(channel);
        }
      };
    }
    throw new Error('Cannot listen to IPC from main process');
  }
}
