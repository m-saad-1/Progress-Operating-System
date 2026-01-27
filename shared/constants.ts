// Application constants

export const APP_NAME = 'Progress OS';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Personal Progress & Goal Tracking Desktop Application';

// Database constants
export const DATABASE_NAME = 'progress.db';
export const DATABASE_VERSION = 4;
export const MAX_BACKUP_COUNT = 30;
export const BACKUP_INTERVAL_HOURS = 6;

// Sync constants
export const SYNC_INTERVAL_MINUTES = 5;
export const SYNC_PROVIDERS = ['supabase', 'firebase', 'custom'] as const;

// UI constants
export const DEFAULT_THEME = 'system';
export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_TIMEZONE = 'UTC';
export const DEFAULT_WEEK_START = 'monday';

// Validation constants
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_TAGS_PER_ITEM = 10;
export const MAX_TAG_LENGTH = 50;

// Date/Time constants
export const DATE_FORMATS = [
  'YYYY-MM-DD',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'MMMM D, YYYY',
] as const;

export const TIME_FORMATS = ['12h', '24h'] as const;

// Priority constants
export const PRIORITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

// Progress constants
export const PROGRESS_COLORS = {
  low: '#10b981',    // green
  medium: '#f59e0b', // yellow
  high: '#ef4444',   // red
  complete: '#3b82f6', // blue
} as const;

// Category constants
export const CATEGORY_COLORS = {
  career: '#3b82f6',   // blue
  health: '#10b981',   // green
  learning: '#8b5cf6', // purple
  finance: '#f59e0b',  // yellow
  personal: '#ec4899', // pink
  custom: '#6b7280',   // gray
} as const;

export const CATEGORY_ICONS = {
  career: '💼',
  health: '🏥',
  learning: '📚',
  finance: '💰',
  personal: '👤',
  custom: '🔧',
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  NEW_GOAL: 'Ctrl+N',
  NEW_TASK: 'Ctrl+T',
  NEW_HABIT: 'Ctrl+H',
  NEW_NOTE: 'Ctrl+Shift+N',
  SEARCH: 'Ctrl+K',
  QUICK_ADD: 'Ctrl+Space',
  UNDO: 'Ctrl+Z',
  REDO: 'Ctrl+Y',
  SAVE: 'Ctrl+S',
  DELETE: 'Delete',
  COMPLETE: 'Ctrl+Enter',
  TOGGLE_SIDEBAR: 'Ctrl+B',
  TOGGLE_THEME: 'Ctrl+Shift+T',
  FOCUS_MODE: 'F11',
  ESCAPE: 'Escape',
} as const;

// Export formats
export const EXPORT_FORMATS = ['json', 'csv', 'pdf'] as const;
export const IMPORT_FORMATS = ['json', 'csv'] as const;

// File size limits
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_BACKUP_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Security constants
export const ENCRYPTION_KEY_SIZE = 32; // bytes for AES-256
export const MIN_PASSWORD_LENGTH = 8;

// Performance constants
export const DEBOUNCE_DELAY = 300; // ms
export const THROTTLE_DELAY = 100; // ms
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Notification constants
export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;
export const NOTIFICATION_DURATION = 5000; // ms

// API endpoints (for sync)
export const API_ENDPOINTS = {
  SUPABASE: 'https://api.supabase.co/v1',
  FIREBASE: 'https://firestore.googleapis.com/v1',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  DATABASE_CONNECTION: 'Unable to connect to database',
  DATABASE_QUERY: 'Database query failed',
  BACKUP_FAILED: 'Backup creation failed',
  RESTORE_FAILED: 'Backup restoration failed',
  SYNC_FAILED: 'Sync failed',
  EXPORT_FAILED: 'Export failed',
  IMPORT_FAILED: 'Import failed',
  VALIDATION_FAILED: 'Validation failed',
  NETWORK_ERROR: 'Network error',
  UNAUTHORIZED: 'Unauthorized access',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource conflict',
  RATE_LIMITED: 'Rate limited',
  INTERNAL_ERROR: 'Internal server error',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  SAVED: 'Saved successfully',
  DELETED: 'Deleted successfully',
  BACKUP_CREATED: 'Backup created successfully',
  BACKUP_RESTORED: 'Backup restored successfully',
  SYNC_COMPLETE: 'Sync completed successfully',
  EXPORT_COMPLETE: 'Export completed successfully',
  IMPORT_COMPLETE: 'Import completed successfully',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  THEME: 'progress-os-theme',
  LANGUAGE: 'progress-os-language',
  SETTINGS: 'progress-os-settings',
  RECENT_SEARCHES: 'progress-os-recent-searches',
  SIDEBAR_STATE: 'progress-os-sidebar-state',
  LAST_VISITED: 'progress-os-last-visited',
  CACHE: 'progress-os-cache',
} as const;

// IPC Channels
export const IPC_CHANNEL_KEYS = {
  DATABASE_INIT: 'database:init',
  DATABASE_GET: 'database:get',
  DATABASE_INSERT: 'database:insert',
  DATABASE_UPDATE: 'database:update',
  DATABASE_DELETE: 'database:delete',
  BACKUP_CREATE: 'backup:create',
  BACKUP_DATA: 'backup:data',
  BACKUP_STATUS: 'backup:status',
  RESTORE_DATA: 'backup:restore-data',
  GET_BACKUPS: 'backup:get-backups',
  DELETE_BACKUP: 'backup:delete-backup',
  GET_BACKUP_STATS: 'backup:get-stats',
  BACKUP_RESTORE: 'backup:restore',
  APP_QUIT: 'app:quit',
  OPEN_EXTERNAL_LINK: 'app:open-external-link',
  GET_APP_VERSION: 'app:get-version',
  GET_PATH: 'app:get-path',
  SHOW_OPEN_DIALOG: 'dialog:show-open',
  SHOW_SAVE_DIALOG: 'dialog:show-save',
  TOGGLE_DARK_MODE: 'settings:toggle-dark-mode',
  GET_SYSTEM_THEME: 'settings:get-system-theme',
  CHECK_FOR_UPDATE: 'updater:check-for-update',
  INSTALL_UPDATE: 'updater:install-update',
  RESTART_APP: 'updater:restart-app',
  DOWNLOAD_PROGRESS: 'updater:download-progress',
} as const;

// Default values
export const DEFAULTS = {
  GOAL: {
    category: 'personal' as const,
    priority: 'medium' as const,
    status: 'active' as const,
    review_frequency: 'weekly' as const,
    progress_method: 'manual' as const,
    progress: 0,
    tags: [],
  },
  TASK: {
    priority: 'medium' as const,
    status: 'pending' as const,
    progress: 0,
    tags: [],
  },
  HABIT: {
    frequency: 'daily' as const,
    schedule: [],
    streak_current: 0,
    streak_longest: 0,
    consistency_score: 0,
  },
  NOTE: {
    type: 'free' as const,
    tags: [],
  },
} as const;