"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULTS = exports.STORAGE_KEYS = exports.SUCCESS_MESSAGES = exports.ERROR_MESSAGES = exports.API_ENDPOINTS = exports.NOTIFICATION_DURATION = exports.NOTIFICATION_TYPES = exports.CACHE_DURATION = exports.THROTTLE_DELAY = exports.DEBOUNCE_DELAY = exports.MIN_PASSWORD_LENGTH = exports.ENCRYPTION_KEY_SIZE = exports.MAX_BACKUP_FILE_SIZE = exports.MAX_IMPORT_FILE_SIZE = exports.IMPORT_FORMATS = exports.EXPORT_FORMATS = exports.KEYBOARD_SHORTCUTS = exports.CATEGORY_ICONS = exports.CATEGORY_COLORS = exports.PROGRESS_COLORS = exports.PRIORITY_WEIGHTS = exports.TIME_FORMATS = exports.DATE_FORMATS = exports.MAX_TAG_LENGTH = exports.MAX_TAGS_PER_ITEM = exports.MAX_DESCRIPTION_LENGTH = exports.MAX_TITLE_LENGTH = exports.DEFAULT_WEEK_START = exports.DEFAULT_TIMEZONE = exports.DEFAULT_LANGUAGE = exports.DEFAULT_THEME = exports.SYNC_PROVIDERS = exports.SYNC_INTERVAL_MINUTES = exports.BACKUP_INTERVAL_HOURS = exports.MAX_BACKUP_COUNT = exports.DATABASE_VERSION = exports.DATABASE_NAME = exports.APP_DESCRIPTION = exports.APP_VERSION = exports.APP_NAME = void 0;
exports.APP_NAME = 'Progress OS';
exports.APP_VERSION = '1.0.0';
exports.APP_DESCRIPTION = 'Personal Progress & Goal Tracking Desktop Application';
exports.DATABASE_NAME = 'progress.db';
exports.DATABASE_VERSION = 4;
exports.MAX_BACKUP_COUNT = 30;
exports.BACKUP_INTERVAL_HOURS = 6;
exports.SYNC_INTERVAL_MINUTES = 5;
exports.SYNC_PROVIDERS = ['supabase', 'firebase', 'custom'];
exports.DEFAULT_THEME = 'system';
exports.DEFAULT_LANGUAGE = 'en';
exports.DEFAULT_TIMEZONE = 'UTC';
exports.DEFAULT_WEEK_START = 'monday';
exports.MAX_TITLE_LENGTH = 200;
exports.MAX_DESCRIPTION_LENGTH = 5000;
exports.MAX_TAGS_PER_ITEM = 10;
exports.MAX_TAG_LENGTH = 50;
exports.DATE_FORMATS = [
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'MMMM D, YYYY',
];
exports.TIME_FORMATS = ['12h', '24h'];
exports.PRIORITY_WEIGHTS = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};
exports.PROGRESS_COLORS = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    complete: '#3b82f6',
};
exports.CATEGORY_COLORS = {
    career: '#3b82f6',
    health: '#10b981',
    learning: '#8b5cf6',
    finance: '#f59e0b',
    personal: '#ec4899',
    custom: '#6b7280',
};
exports.CATEGORY_ICONS = {
    career: '💼',
    health: '🏥',
    learning: '📚',
    finance: '💰',
    personal: '👤',
    custom: '🔧',
};
exports.KEYBOARD_SHORTCUTS = {
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
};
exports.EXPORT_FORMATS = ['json', 'csv', 'pdf'];
exports.IMPORT_FORMATS = ['json', 'csv'];
exports.MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;
exports.MAX_BACKUP_FILE_SIZE = 100 * 1024 * 1024;
exports.ENCRYPTION_KEY_SIZE = 32;
exports.MIN_PASSWORD_LENGTH = 8;
exports.DEBOUNCE_DELAY = 300;
exports.THROTTLE_DELAY = 100;
exports.CACHE_DURATION = 5 * 60 * 1000;
exports.NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'];
exports.NOTIFICATION_DURATION = 5000;
exports.API_ENDPOINTS = {
    SUPABASE: 'https://api.supabase.co/v1',
    FIREBASE: 'https://firestore.googleapis.com/v1',
};
exports.ERROR_MESSAGES = {
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
};
exports.SUCCESS_MESSAGES = {
    SAVED: 'Saved successfully',
    DELETED: 'Deleted successfully',
    BACKUP_CREATED: 'Backup created successfully',
    BACKUP_RESTORED: 'Backup restored successfully',
    SYNC_COMPLETE: 'Sync completed successfully',
    EXPORT_COMPLETE: 'Export completed successfully',
    IMPORT_COMPLETE: 'Import completed successfully',
};
exports.STORAGE_KEYS = {
    THEME: 'progress-os-theme',
    LANGUAGE: 'progress-os-language',
    SETTINGS: 'progress-os-settings',
    RECENT_SEARCHES: 'progress-os-recent-searches',
    SIDEBAR_STATE: 'progress-os-sidebar-state',
    LAST_VISITED: 'progress-os-last-visited',
    CACHE: 'progress-os-cache',
};
exports.DEFAULTS = {
    GOAL: {
        category: 'personal',
        priority: 'medium',
        status: 'active',
        review_frequency: 'weekly',
        progress_method: 'manual',
        progress: 0,
        tags: [],
    },
    TASK: {
        priority: 'medium',
        status: 'pending',
        progress: 0,
        tags: [],
    },
    HABIT: {
        frequency: 'daily',
        schedule: [],
        streak_current: 0,
        streak_longest: 0,
        consistency_score: 0,
    },
    NOTE: {
        type: 'free',
        tags: [],
    },
};
//# sourceMappingURL=constants.js.map