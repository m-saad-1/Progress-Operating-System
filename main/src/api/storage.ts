/**
 * Storage API
 *
 * Abstracts persistent storage (application settings, preferences, etc).
 * Electron: Uses electron-store
 * Tauri: Uses tauri::api::store
 */

type StoreLike = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  delete: (key: string) => void;
  clear: () => void;
  has: (key: string) => boolean;
  store: unknown;
};

export interface StorageOptions {
  name?: string;
  cwd?: string;
}

export class StorageAPI {
  private store: StoreLike;

  constructor(options?: StorageOptions) {
    // Use dynamic require so this file doesn't hard-fail type resolution when
    // electron-store is only present in specific package scopes.
    const ElectronStore = require('electron-store') as new (opts: { name: string; cwd?: string }) => StoreLike;
    this.store = new ElectronStore({
      name: options?.name || 'personal-os',
      cwd: options?.cwd,
    });
  }

  /**
   * Get a value from storage
   * @example
   *   const theme = await api.storage.get('theme', 'dark');
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      const value = this.store.get(key);
      return (value ?? defaultValue) as T;
    } catch (error) {
      console.error('[Storage] Get error:', error);
      return defaultValue as T;
    }
  }

  /**
   * Set a value in storage
   * @example
   *   await api.storage.set('theme', 'light');
   */
  async set<T = any>(key: string, value: T): Promise<void> {
    try {
      this.store.set(key, value);
    } catch (error) {
      console.error('[Storage] Set error:', error);
      throw error;
    }
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string): Promise<void> {
    try {
      this.store.delete(key);
    } catch (error) {
      console.error('[Storage] Delete error:', error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      this.store.clear();
    } catch (error) {
      console.error('[Storage] Clear error:', error);
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      return this.store.has(key);
    } catch (error) {
      console.error('[Storage] Has error:', error);
      return false;
    }
  }

  /**
   * Get all stored data (be careful with sensitive data)
   */
  async getAll(): Promise<Record<string, any>> {
    try {
      return this.store.store as Record<string, any>;
    } catch (error) {
      console.error('[Storage] GetAll error:', error);
      return {};
    }
  }
}
