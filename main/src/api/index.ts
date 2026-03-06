/**
 * Desktop API Abstraction Layer
 *
 * This module provides a platform-agnostic interface for desktop operations.
 * It allows the main app code to remain independent of Electron/Tauri specifics.
 *
 * Example usage in renderer:
 *   const api = window.desktopAPI;
 *   await api.notifications.show({ title: 'Hello', body: 'World' });
 *
 * Migration to Tauri: Replace implementations without touching calling code.
 */

import { NotificationAPI } from './notifications';
import { StorageAPI } from './storage';
import { FileSystemAPI } from './filesystem';
import { IpcAPI } from './ipc';
import { WindowAPI } from './window';
import { AppAPI } from './app';

export interface DesktopAPI {
  notifications: NotificationAPI;
  storage: StorageAPI;
  filesystem: FileSystemAPI;
  ipc: IpcAPI;
  window: WindowAPI;
  app: AppAPI;
}

let instance: DesktopAPI | null = null;

export function initializeDesktopAPI(): DesktopAPI {
  if (instance) return instance;

  instance = {
    notifications: new NotificationAPI(),
    storage: new StorageAPI(),
    filesystem: new FileSystemAPI(),
    ipc: new IpcAPI(),
    window: new WindowAPI(),
    app: new AppAPI(),
  };

  return instance;
}

export function getDesktopAPI(): DesktopAPI {
  if (!instance) {
    throw new Error('Desktop API not initialized. Call initializeDesktopAPI() first.');
  }
  return instance;
}
