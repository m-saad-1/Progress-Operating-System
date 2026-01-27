// Common TypeScript types shared between main and renderer

export type UUID = string;

export interface BaseEntity {
  id: UUID;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface Goal extends BaseEntity {
  title: string;
  description: string;
  category: GoalCategory;
  priority: Priority;
  status: GoalStatus;
  start_date: string;
  target_date: string | null;
  motivation: string;
  review_frequency: ReviewFrequency;
  progress_method: ProgressMethod;
  progress: number;
  tags: string[];
}

export interface Project extends BaseEntity {
  goal_id: UUID;
  title: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string | null;
  progress: number;
}

export interface Task extends BaseEntity {
  title: string;
  description: string;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  estimated_time: number | null;
  actual_time: number | null;
  recurrence_rule: string | null;
  project_id: UUID | null;
  goal_id: UUID | null;
  parent_task_id: UUID | null;
  tags: string[];
  completed_at: string | null;
}

export interface ChecklistItem extends Omit<BaseEntity, 'version'> {
  task_id: UUID;
  title: string;
  completed: boolean;
  weight: number;
}

export interface Habit extends BaseEntity {
  title: string;
  description: string;
  frequency: HabitFrequency;
  schedule: string[];
  goal_id: UUID | null;
  streak_current: number;
  streak_longest: number;
  consistency_score: number;
}

export interface HabitCompletion extends Omit<BaseEntity, 'version' | 'deleted_at'> {
  habit_id: UUID;
  date: string;
  completed: boolean;
  notes: string | null;
}

export interface Note extends BaseEntity {
  title: string;
  content: string;
  type: NoteType;
  mood: string | null;
  goal_id: UUID | null;
  task_id: UUID | null;
  tags: string[];
}

export interface TimeBlock extends Omit<BaseEntity, 'version'> {
  task_id: UUID | null;
  habit_id: UUID | null;
  start_time: string;
  end_time: string;
  duration: number;
  notes: string | null;
}

export interface AuditLog {
  id: UUID;
  entity_type: string;
  entity_id: UUID;
  action: AuditAction;
  old_value: any;
  new_value: any;
  user_id: string;
  timestamp: string;
  ip_address: string | null;
}

export interface Backup {
  id: UUID;
  path: string;
  timestamp: string;
  size: number;
  checksum: string;
  version: number;
}

export interface SyncState {
  id: UUID;
  entity_type: string;
  entity_id: UUID;
  last_synced: string;
  sync_version: number;
  pending: boolean;
}

// Enums
export enum GoalCategory {
  CAREER = 'career',
  HEALTH = 'health',
  LEARNING = 'learning',
  FINANCE = 'finance',
  PERSONAL = 'personal',
  CUSTOM = 'custom',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum GoalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
}

export enum HabitFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum NoteType {
  FREE = 'free',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  GOAL = 'goal',
  TASK = 'task',
}

export enum ReviewFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

export enum ProgressMethod {
  MANUAL = 'manual',
  TASK_BASED = 'task-based',
  MILESTONE_BASED = 'milestone-based',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  RESTORE = 'restore',
}

// Request/Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface FilterOptions {
  search?: string;
  status?: string;
  category?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Event types
export interface SyncEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  data?: any;
}

export interface BackupEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  backupId?: string;
  progress?: number;
}

export interface Notification {
  id: UUID;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
}

// Settings types
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  weekStart: 'sunday' | 'monday';
  dateFormat: string;
  timeFormat: '12h' | '24h';
  compactMode: boolean;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoBackup: boolean;
  syncEnabled: boolean;
  encryptionEnabled: boolean;
}

// Statistics types
export interface DailyStats {
  date: string;
  tasksCompleted: number;
  habitsCompleted: number;
  focusTime: number;
  productivityScore: number;
}

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalTasks: number;
  completedTasks: number;
  totalHabits: number;
  completedHabits: number;
  totalFocusTime: number;
  averageProductivity: number;
  consistencyScore: number;
}

export interface MonthlyStats {
  month: string;
  year: number;
  goalsCreated: number;
  goalsCompleted: number;
  tasksCreated: number;
  tasksCompleted: number;
  habitsCreated: number;
  averageConsistency: number;
  totalFocusTime: number;
}