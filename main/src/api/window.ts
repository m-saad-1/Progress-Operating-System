/**
 * Window API
 *
 * Abstracts window operations.
 * Electron: Uses BrowserWindow
 * Tauri: Uses tauri::Window API
 */

import { BrowserWindow } from 'electron';

export class WindowAPI {
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Minimize the main window
   */
  minimize(): void {
    this.mainWindow?.minimize();
  }

  /**
   * Maximize the main window
   */
  maximize(): void {
    this.mainWindow?.maximize();
  }

  /**
   * Restore/unmaximize the main window
   */
  restore(): void {
    this.mainWindow?.restore();
  }

  /**
   * Check if window is maximized
   */
  isMaximized(): boolean {
    return this.mainWindow?.isMaximized() ?? false;
  }

  /**
   * Toggle maximize/unmaximize
   */
  toggleMaximize(): void {
    if (this.isMaximized()) {
      this.restore();
    } else {
      this.maximize();
    }
  }

  /**
   * Close the main window
   */
  close(): void {
    this.mainWindow?.close();
  }

  /**
   * Move window to front
   */
  focus(): void {
    this.mainWindow?.focus();
  }

  /**
   * Get window size
   */
  getSize(): [number, number] {
    if (!this.mainWindow) return [0, 0];
    const [width, height] = this.mainWindow.getSize();
    return [width, height];
  }

  /**
   * Set window size
   */
  setSize(width: number, height: number): void {
    this.mainWindow?.setSize(width, height);
  }

  /**
   * Get window position
   */
  getPosition(): [number, number] {
    if (!this.mainWindow) return [0, 0];
    const [x, y] = this.mainWindow.getPosition();
    return [x, y];
  }

  /**
   * Set window position
   */
  setPosition(x: number, y: number): void {
    this.mainWindow?.setPosition(x, y);
  }

  /**
   * Check if window is visible
   */
  isVisible(): boolean {
    return this.mainWindow?.isVisible() ?? false;
  }

  /**
   * Show the window
   */
  show(): void {
    this.mainWindow?.show();
  }

  /**
   * Hide the window
   */
  hide(): void {
    this.mainWindow?.hide();
  }
}
