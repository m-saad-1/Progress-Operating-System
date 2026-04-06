/**
 * App API
 *
 * Abstracts application-level operations.
 * Electron: Uses electron.app
 * Tauri: Uses tauri::api::app, tauri::app
 */

import { app, shell } from 'electron';

export class AppAPI {
  /**
   * Get application version
   */
  getVersion(): string {
    return app.getVersion();
  }

  /**
   * Get platform (win32, darwin, linux)
   */
  getPlatform(): string {
    return process.platform;
  }

  /**
   * Get application path (userData, appData, home, etc.)
   * @example
   *   const userDataPath = api.app.getPath('userData');
   */
  getPath(name: string): string {
    return app.getPath(name as any);
  }

  /**
   * Open a URL in the default browser
   */
  async openExternal(url: string): Promise<void> {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error('[App] Open external error:', error);
      throw error;
    }
  }

  /**
   * Open a file or folder in the default application
   */
  async openPath(path: string): Promise<string> {
    try {
      return await shell.openPath(path);
    } catch (error) {
      console.error('[App] Open path error:', error);
      throw error;
    }
  }

  /**
   * Relaunch the application
   */
  relaunch(): void {
    app.relaunch();
    app.quit();
  }

  /**
   * Quit the application
   */
  quit(): void {
    app.quit();
  }

  /**
   * Get app name
   */
  getName(): string {
    return app.getName();
  }

  /**
   * Check if app is ready
   */
  isReady(): boolean {
    return app.isReady();
  }

  /**
   * Exit with code
   */
  exit(code: number = 0): void {
    process.exit(code);
  }
}
