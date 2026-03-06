/**
 * Notifications API
 *
 * Abstracts desktop notifications.
 * Electron: Uses Notification class
 * Tauri: Uses tauri::api::notification::notify
 */

import { Notification } from 'electron';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string; // For grouping/replacing notifications
  sound?: string; // Path to sound file
  urgency?: 'low' | 'normal' | 'high'; // Linux-specific
}

export class NotificationAPI {
  /**
   * Show a desktop notification
   * @example
   *   await api.notifications.show({
   *     title: 'Task Updated',
   *     body: 'Your task "Build feature" was completed'
   *   });
   */
  async show(options: NotificationOptions): Promise<void> {
    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        ...(options.sound && { icon: options.sound }),
      });

      notification.show();

      return Promise.resolve();
    } catch (error) {
      console.error('[Notifications]', error);
      throw error;
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return Notification.isSupported();
  }

  /**
   * Request notification permission (macOS only, always granted on other platforms)
   */
  async requestPermission(): Promise<'granted' | 'denied'> {
    if (!Notification.isSupported()) {
      return 'denied';
    }
    // Electron auto-grants on Windows/Linux
    return 'granted';
  }
}
