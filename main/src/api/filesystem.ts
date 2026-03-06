/**
 * Filesystem API
 *
 * Abstracts file operations (open dialog, save dialog, read/write).
 * Electron: Uses electron.dialog, fs-extra
 * Tauri: Uses tauri::api::dialog, tauri::api::fs
 */

import { dialog, BrowserWindow } from 'electron';
import fs from 'fs-extra';
import path from 'path';

export interface OpenFileOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: (
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
  )[];
}

export interface SaveFileOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modified: number;
}

export class FileSystemAPI {
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Show open file dialog
   * @example
   *   const files = await api.filesystem.openFile({
   *     filters: [{ name: 'JSON', extensions: ['json'] }]
   *   });
   */
  async openFile(options: OpenFileOptions): Promise<string[] | null> {
    try {
      const result = await dialog.showOpenDialog(this.mainWindow || {}, {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        filters: options.filters,
        properties: options.properties || ['openFile'],
      });

      return result.canceled ? null : result.filePaths;
    } catch (error) {
      console.error('[FileSystem] Open file error:', error);
      throw error;
    }
  }

  /**
   * Show save file dialog
   * @example
   *   const file = await api.filesystem.saveFile({
   *     defaultPath: 'backup.json'
   *   });
   */
  async saveFile(options: SaveFileOptions): Promise<string | null> {
    try {
      const result = await dialog.showSaveDialog(this.mainWindow || {}, {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        filters: options.filters,
      });

      return result.canceled ? null : result.filePath;
    } catch (error) {
      console.error('[FileSystem] Save file error:', error);
      throw error;
    }
  }

  /**
   * Read file contents
   */
  async readFile(filePath: string, encoding: string = 'utf-8'): Promise<string> {
    try {
      return await fs.readFile(filePath, encoding);
    } catch (error) {
      console.error('[FileSystem] Read file error:', error);
      throw error;
    }
  }

  /**
   * Write file contents
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content);
    } catch (error) {
      console.error('[FileSystem] Write file error:', error);
      throw error;
    }
  }

  /**
   * Read file as JSON
   */
  async readJSON<T = any>(filePath: string): Promise<T> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      console.error('[FileSystem] Read JSON error:', error);
      throw error;
    }
  }

  /**
   * Write file as JSON
   */
  async writeJSON<T = any>(filePath: string, data: T): Promise<void> {
    try {
      await this.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[FileSystem] Write JSON error:', error);
      throw error;
    }
  }

  /**
   * Delete file or directory
   */
  async delete(targetPath: string): Promise<void> {
    try {
      await fs.remove(targetPath);
    } catch (error) {
      console.error('[FileSystem] Delete error:', error);
      throw error;
    }
  }

  /**
   * Check if file/directory exists
   */
  async exists(targetPath: string): Promise<boolean> {
    try {
      return await fs.pathExists(targetPath);
    } catch (error) {
      console.error('[FileSystem] Exists error:', error);
      return false;
    }
  }

  /**
   * Get file info
   */
  async getInfo(targetPath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(targetPath);
      return {
        name: path.basename(targetPath),
        path: targetPath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modified: stats.mtime.getTime(),
      };
    } catch (error) {
      console.error('[FileSystem] Get info error:', error);
      throw error;
    }
  }
}
