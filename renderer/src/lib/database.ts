import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { safeToDayKeyParts } from '@/lib/date-safe'
import { calculateHabitStreaks } from '@/lib/habit-streaks'
import type { Habit as SharedHabit, HabitCompletion as SharedHabitCompletion } from '@/types'

// Database types and interfaces
export interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'career' | 'health' | 'learning' | 'finance' | 'personal' | 'custom';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'paused' | 'completed' | 'archived';
  start_date: string;
  target_date: string | null;
  motivation: string;
  review_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  progress_method: 'manual' | 'task-based' | 'milestone-based';
  progress: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface Project {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface DailyTaskState {
  progress: number;
  status: 'pending' | 'in-progress' | 'blocked' | 'completed' | 'skipped';
  recorded_at: string;
  source: 'user' | 'rollover' | 'reset' | 'restore' | 'paused';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'blocked' | 'completed' | 'skipped';
  progress: number;
  daily_progress?: Record<string, DailyTaskState>;
  estimated_time: number | null;
  actual_time: number | null;
  recurrence_rule: string | null;
  project_id: string | null;
  goal_id: string | null;
  parent_task_id: string | null;
  tags: string[];
  last_reset_date?: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  version: number;
  goal_title?: string; // Joined from goals table
  duration_type?: 'today' | 'continuous';
  is_paused?: boolean;
  paused_at?: string | null;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  weight: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Habit {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  schedule: string[];
  goal_id: string | null;
  streak_current: number;
  streak_longest: number;
  consistency_score: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  goal_title?: string; // Joined from goals table
  today_completed?: boolean; // Today's completion status
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'free' | 'daily' | 'weekly' | 'goal' | 'task' | 'challenge' | 'career';
  mood: string | null;
  goal_id: string | null;
  task_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  goal_title?: string; // Joined from goals table
  task_title?: string; // Joined from tasks table
}

export interface TimeBlock {
  id: string;
  task_id: string | null;
  habit_id: string | null;
  start_time: string;
  end_time: string;
  duration: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  task_title?: string; // Joined from tasks table
  habit_title?: string; // Joined from habits table
}


export interface UserPreferences {
  id: string;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  week_start: 'sunday' | 'monday';
  language: string;
  compact_mode: boolean;
  animations_enabled: boolean;
  sound_enabled: boolean;
  sync_enabled: boolean;
  sync_provider: string;
  sync_endpoint: string;
  sync_api_key: string;
  sync_interval: number;
  encryption_key: string;
  created_at: string;
  updated_at: string;
}

export interface Backup {
  id: string;
  path: string;
  timestamp: string;
  size: number;
  checksum: string;
  version: number;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  old_value: any;
  new_value: any;
  user_id: string;
  timestamp: string;
  ip_address: string | null;
}

export interface SyncState {
  id: string;
  entity_type: string;
  entity_id: string;
  last_synced: string;
  sync_version: number;
  pending: boolean;
}

// Filter interfaces
export interface GoalFilters {
  status?: Goal['status'];
  category?: Goal['category'];
  priority?: Goal['priority'];
  search?: string;
}

export interface TaskFilters {
  status?: Task['status'];
  priority?: Task['priority'];
  dueDate?: string;
  goalId?: string;
  search?: string;
}

export interface HabitFilters {
  frequency?: Habit['frequency'];
  goalId?: string;
  search?: string;
}

export interface NoteFilters {
  type?: Note['type'];
  goalId?: string;
  taskId?: string;
  search?: string;
}

export interface TimeBlockFilters {
  startDate?: string;
  endDate?: string;
  taskId?: string;
  habitId?: string;
}

// Create/Update DTOs
export interface CreateGoalDTO {
  title: string;
  description?: string;
  category: Goal['category'];
  priority: Goal['priority'];
  target_date?: string;
  motivation?: string;
  review_frequency?: Goal['review_frequency'];
  progress_method?: Goal['progress_method'];
  tags?: string[];
}

export interface UpdateGoalDTO extends Partial<CreateGoalDTO> {
  status?: Goal['status'];
  progress?: number;
  completed_at?: string | null;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  due_date?: string;
  priority: Task['priority'];
  estimated_time?: number;
  goal_id?: string;
  tags?: string[];
  duration_type?: 'today' | 'continuous'; // Today only vs Multi-day/Continuous
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {
  status?: Task['status'];
  progress?: number;
  actual_time?: number;
  daily_progress?: Record<string, DailyTaskState>;
  duration_type?: 'today' | 'continuous';
  is_paused?: boolean;
  paused_at?: string | null;
  last_reset_date?: string | null;
  completed_at?: string | null;
}

export interface CreateHabitDTO {
  title: string;
  description?: string;
  frequency: Habit['frequency'];
  schedule?: string[];
  goal_id?: string;
}

export interface UpdateHabitDTO extends Partial<CreateHabitDTO> {
  streak_current?: number;
  streak_longest?: number;
  consistency_score?: number;
}

export interface CreateNoteDTO {
  title: string;
  content: string;
  type: 'free' | 'daily' | 'weekly' | 'goal' | 'task' | 'challenge' | 'career';
  mood?: string;
  goal_id?: string;
  task_id?: string;
  tags?: string[];
  pinned?: boolean;
}

export interface UpdateNoteDTO extends Partial<CreateNoteDTO> {}

export interface CreateTimeBlockDTO {
  task_id?: string;
  habit_id?: string;
  start_time: string;
  end_time: string;
  duration: number;
  notes?: string;
}

export interface TaskPeriodStats {
  total: number;
  completed: number;
  partially: number;
  skipped: number;
  plannedWeight: number;
  earnedWeight: number;
  weightedProgress: number;
}

export interface TaskTabStatsSnapshot {
  today: {
    total: number;
    completed: number;
    partially: number;
    skipped: number;
    plannedWeight: number;
    earnedWeight: number;
    weightedProgress: number;
  };
  weekly: TaskPeriodStats;
  previousWeekly: TaskPeriodStats;
  monthly: TaskPeriodStats;
  previousMonthly: TaskPeriodStats;
  health: TaskPeriodStats;
}

export interface TaskMonthlyTrendPoint {
  dateKey: string;
  day: string;
  month: string;
  fullMonth: string;
  progress: number;
  completionRate: number;
  completed: number;
  total: number;
  target: number;
}

export interface TaskDailyActivityPoint {
  dateKey: string;
  date: string;
  day: string;
  completed: number;
  updates: number;
  progress: number;
}

export interface TaskAnalyticsChartSnapshot {
  monthlyTrend: TaskMonthlyTrendPoint[];
  dailyActivity: TaskDailyActivityPoint[];
  heatmap: number[][];
  heatmapYear: number;
  heatmapStartDate: string;
}

export interface TaskMonthlyHistoryPoint {
  monthKey: string;
  monthLabel: string;
  total: number;
  completed: number;
  plannedWeight: number;
  earnedWeight: number;
  completionRate: number;
  consistency: number;
}

export interface TaskRangePriorityStats {
  total: number;
  completed: number;
  plannedWeight: number;
  earnedWeight: number;
}

export interface TaskRangeDaySnapshot {
  dateKey: string;
  date: string;
  day: string;
  total: number;
  completed: number;
  partially: number;
  skipped: number;
  plannedWeight: number;
  earnedWeight: number;
  weightedProgress: number;
}

export interface TaskRangeAnalyticsSnapshot {
  startDate: string;
  endDate: string;
  summary: TaskPeriodStats;
  overdue: number;
  byPriority: {
    high: TaskRangePriorityStats;
    medium: TaskRangePriorityStats;
    low: TaskRangePriorityStats;
  };
  daily: TaskRangeDaySnapshot[];
}

/**
 * Returns the current local date as YYYY-MM-DD string.
 * This is critical for habit completions to avoid UTC timezone issues.
 * Using toISOString() would convert to UTC which can shift the date by a day.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const deriveStatusFromProgress = (
  progress: number,
  fallback: DailyTaskState['status'] = 'pending'
): DailyTaskState['status'] => {
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'in-progress'
  if (progress === -1) return 'pending'
  return fallback
}

const normalizeToLocalDayKey = (value: string | null | undefined, fallbackDayKey: string): string => {
  if (!value) return fallbackDayKey
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return getLocalDateString(parsed)
  }
  return fallbackDayKey
}

const isFinalizedPastDay = (dayKey: string, todayKey: string): boolean => dayKey < todayKey

const isSkippedOrEmptyState = (entry: { progress?: number | null; status?: DailyTaskState['status'] | null }): boolean => {
  const status = entry.status ?? 'pending'
  const progress = entry.progress ?? 0
  return status === 'skipped' || (progress <= 0 && status !== 'completed')
}

const normalizeDailyProgressFromDb = (
  rawValue: any,
  task: Partial<Task>
): Record<string, DailyTaskState> => {
  let parsed: any = rawValue
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue)
    } catch {
      parsed = {}
    }
  }

  const normalized: Record<string, DailyTaskState> = {}
  const fallbackTimestamp = task.updated_at || task.created_at || new Date().toISOString()
  const fallbackDayKey = normalizeToLocalDayKey(task.created_at || task.updated_at, getLocalDateString(new Date()))

  Object.entries(parsed || {}).forEach(([date, entry]) => {
    const normalizedDate = normalizeToLocalDayKey(date, fallbackDayKey)

    if (entry && typeof entry === 'object' && 'progress' in (entry as any)) {
      const value = entry as any
      const progress = typeof value.progress === 'number' ? value.progress : -1
      const nextState: DailyTaskState = {
        progress,
        status: (value.status as DailyTaskState['status']) || deriveStatusFromProgress(progress, 'pending'),
        recorded_at: value.recorded_at || fallbackTimestamp,
        source: value.source || 'user',
      }

      const existing = normalized[normalizedDate]
      if (!existing || (nextState.recorded_at || '') >= (existing.recorded_at || '')) {
        normalized[normalizedDate] = nextState
      }
    } else {
      const progress = typeof entry === 'number' ? entry : -1
      const nextState: DailyTaskState = {
        progress,
        status: deriveStatusFromProgress(progress, 'pending'),
        recorded_at: fallbackTimestamp,
        source: 'user',
      }

      const existing = normalized[normalizedDate]
      if (!existing || (nextState.recorded_at || '') >= (existing.recorded_at || '')) {
        normalized[normalizedDate] = nextState
      }
    }
  })

  return normalized
}

const serializeDailyProgress = (history?: Record<string, DailyTaskState>): string => {
  return JSON.stringify(history || {})
}

/**
 * Intelligently infer task state for a historical day.
 * Checks completed_at timestamp and historical snapshots to determine progress.
 */
const inferTaskStateForDay = (
  task: { completed_at?: string | null; progress?: number | null; status?: DailyTaskState['status'] | null; is_continuous?: number | boolean },
  dayKey: string,
  normalizedHistory: Record<string, DailyTaskState>,
  _todayKey: string,
  _getTaskLifecycleEndKey: (task: any) => string
): { progress: number; status: DailyTaskState['status'] } => {
  // If task was completed and completed_at <= dayKey, infer 100% completion
  if (task.completed_at) {
    const completedDayKey = getLocalDateString(new Date(task.completed_at))
    if (completedDayKey <= dayKey) {
      return { progress: task.progress ?? 100, status: 'completed' }
    }
  }

  // For continuous tasks, find nearest historical snapshot
  const isContinuous = task.is_continuous === 1 || task.is_continuous === true
  if (isContinuous) {
    const sortedDays = Object.keys(normalizedHistory).sort()
    const nearestDay = sortedDays
      .filter(d => d <= dayKey)
      .reverse()[0]
    
    if (nearestDay) {
      const entry = normalizedHistory[nearestDay]
      return { progress: entry.progress ?? 0, status: entry.status ?? 'pending' }
    }
  }

  // Default to pending with 0% if no evidence of completion
  return { progress: 0, status: 'pending' }
}

const TASK_METADATA_DELETED_SENTINEL = '__deleted_task_metadata__'

// Database service class
export class DatabaseService {
  private static instance: DatabaseService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Check if Electron API is available
    if (!window.electronAPI) {
      console.warn('Electron API not available. Database operations will be simulated.');
      this.isInitialized = true;
      return;
    }
    
    try {
      // Test connection
      const response = await window.electronAPI.executeQuery('SELECT 1');
      // Handle wrapped response - just check if it succeeded
      if (response && typeof response === 'object' && 'success' in response && !response.success) {
        throw new Error(response.error || 'Database connection test failed');
      }
      this.isInitialized = true;
      console.log('Database service initialized');
    } catch (error) {
      console.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  // Helper method for safe database operations
  private async executeQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!window.electronAPI) {
      console.warn('Electron API not available, returning mock data');
      return [];
    }
    
    try {
      const response = await window.electronAPI.executeQuery(query, params);
      // Handle wrapped response from IPC { success: boolean, data: any }
      if (response && typeof response === 'object' && 'success' in response) {
        if (!response.success) {
          throw new Error(response.error || 'Query failed');
        }
        const data = response.data;
        return Array.isArray(data) ? data : [];
      }
      // Handle direct response
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Database query failed:', error);
      throw error;
    }
  }

  private async executeTransaction(operations: Array<{query: string, params?: any[]}>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!window.electronAPI) {
      console.warn('Electron API not available, skipping transaction');
      return;
    }
    
    try {
      const response = await window.electronAPI.executeTransaction(operations);
      // Handle wrapped response from IPC { success: boolean, data: any }
      if (response && typeof response === 'object' && 'success' in response) {
        if (!response.success) {
          throw new Error(response.error || 'Transaction failed');
        }
      }
    } catch (error) {
      console.error('Database transaction failed:', error);
      throw error;
    }
  }

  // Goals CRUD
  async getGoals(filters?: GoalFilters): Promise<Goal[]> {
    let query = 'SELECT * FROM goals WHERE deleted_at IS NULL';
    const params: any[] = [];
    
    if (filters) {
      const conditions = [];
      
      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }
      
      if (filters.category) {
        conditions.push('category = ?');
        params.push(filters.category);
      }
      
      if (filters.priority) {
        conditions.push('priority = ?');
        params.push(filters.priority);
      }
      
      if (filters.search) {
        conditions.push('(title LIKE ? OR description LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const results = await this.executeQuery<any>(query, params);
    return results.map(goal => ({
      ...goal,
      tags: Array.isArray(goal.tags) ? goal.tags : JSON.parse(goal.tags || '[]'),
    }));
  }

  async getGoalById(id: string): Promise<Goal | null> {
    const results = await this.executeQuery<Goal>(
      'SELECT * FROM goals WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    if (results.length === 0) return null;
    
    const goal = results[0];
    return {
      ...goal,
      tags: Array.isArray(goal.tags) ? goal.tags : JSON.parse(goal.tags || '[]'),
    };
  }

  async createGoal(data: CreateGoalDTO): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        INSERT INTO goals (
          id, title, description, category, priority, status, 
          start_date, target_date, motivation, review_frequency, 
          progress_method, progress, tags, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)
      `,
      params: [
        id,
        data.title,
        data.description || '',
        data.category || 'personal',
        data.priority || 'medium',
        now,
        data.target_date || null,
        data.motivation || '',
        data.review_frequency || 'weekly',
        data.progress_method || 'manual',
        JSON.stringify(data.tags || []),
        now,
        now,
      ]
    }]);
    
    return id;
  }

  async updateGoal(id: string, data: UpdateGoalDTO): Promise<void> {
    const now = new Date().toISOString();
    
    // Build dynamic update query based on provided fields
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description || '');
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category);
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?');
      params.push(data.priority);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
      // Set progress to 100 when marking as completed
      if (data.status === 'completed' && data.progress === undefined) {
        updates.push('progress = ?');
        params.push(100);
      }
    }
    if (data.completed_at !== undefined) {
      updates.push('completed_at = ?');
      params.push(data.completed_at);
    }
    if (data.target_date !== undefined) {
      updates.push('target_date = ?');
      params.push(data.target_date || null);
    }
    if (data.motivation !== undefined) {
      updates.push('motivation = ?');
      params.push(data.motivation || '');
    }
    if (data.review_frequency !== undefined) {
      updates.push('review_frequency = ?');
      params.push(data.review_frequency);
    }
    if (data.progress_method !== undefined) {
      updates.push('progress_method = ?');
      params.push(data.progress_method);
    }
    if (data.progress !== undefined) {
      updates.push('progress = ?');
      params.push(data.progress);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags || []));
    }
    
    // Always update timestamp and version
    updates.push('updated_at = ?');
    params.push(now);
    updates.push('version = version + 1');
    
    // Add the ID at the end for the WHERE clause
    params.push(id);
    
    await this.executeTransaction([{
      query: `UPDATE goals SET ${updates.join(', ')} WHERE id = ?`,
      params
    }]);
  }

  async deleteGoal(id: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        UPDATE goals 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  async getGoalProgress(id: string): Promise<number> {
    // Calculate progress based on associated tasks
    const results = await this.executeQuery<{progress: number}>(
      `SELECT 
        COALESCE(AVG(progress), 0) as progress
       FROM tasks 
       WHERE goal_id = ? 
       AND deleted_at IS NULL
       AND status != 'completed'`,
      [id]
    );
    
    return results[0]?.progress || 0;
  }

  // Tasks CRUD
  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    let query = `
      SELECT t.*, g.title as goal_title
      FROM tasks t
      LEFT JOIN goals g ON t.goal_id = g.id
      WHERE t.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (filters) {
      const conditions = [];
      
      if (filters.status) {
        conditions.push('t.status = ?');
        params.push(filters.status);
      }
      
      if (filters.priority) {
        conditions.push('t.priority = ?');
        params.push(filters.priority);
      }
      
      if (filters.dueDate) {
        conditions.push('t.due_date = ?');
        params.push(filters.dueDate);
      }
      
      if (filters.goalId) {
        conditions.push('t.goal_id = ?');
        params.push(filters.goalId);
      }
      
      if (filters.search) {
        conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }
    }
    
    query += ' ORDER BY t.priority DESC, t.due_date ASC';
    
    const results = await this.executeQuery<Task>(query, params);
    return results.map(task => {
      const rawIsPaused = (task as any).is_paused;
      return {
        ...task,
        tags: Array.isArray(task.tags) ? task.tags : JSON.parse(typeof task.tags === 'string' ? task.tags : '[]'),
        daily_progress: normalizeDailyProgressFromDb((task as any).daily_progress, task),
        is_paused: rawIsPaused === 1 || rawIsPaused === '1' || rawIsPaused === true,
      };
    });
  }

  async getTaskById(id: string): Promise<Task | null> {
    const results = await this.executeQuery<Task>(
      `SELECT t.*, g.title as goal_title 
       FROM tasks t 
       LEFT JOIN goals g ON t.goal_id = g.id 
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [id]
    );
    
    if (results.length === 0) return null;
    
    const task = results[0];
    const rawIsPaused = (task as any).is_paused;
    return {
      ...task,
      tags: Array.isArray(task.tags) ? task.tags : JSON.parse(typeof task.tags === 'string' ? task.tags : '[]'),
      daily_progress: normalizeDailyProgressFromDb((task as any).daily_progress, task),
      is_paused: rawIsPaused === 1 || rawIsPaused === '1' || rawIsPaused === true,
    };
  }

  async createTask(data: CreateTaskDTO): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const todayKey = getLocalDateString(new Date());
    const initialDailyProgress = serializeDailyProgress({
      [todayKey]: {
        progress: 0,
        status: 'pending',
        recorded_at: now,
        source: 'user',
      },
    });
    const lastResetDate = data.duration_type === 'continuous' ? todayKey : null;
    
    await this.executeTransaction([{
      query: `
        INSERT INTO tasks (
          id, title, description, due_date, priority, status, progress,
          estimated_time, actual_time, goal_id, tags, duration_type, daily_progress, last_reset_date, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      params: [
        id,
        data.title,
        data.description || '',
        data.due_date || null,
        data.priority || 'medium',
        data.estimated_time || null,
        data.goal_id || null,
        JSON.stringify(data.tags || []),
        data.duration_type || 'today', // Default to 'today' if not specified
        initialDailyProgress,
        lastResetDate,
        now,
        now,
      ]
    }]);
    
    return id;
  }

  async updateTask(id: string, data: UpdateTaskDTO): Promise<void> {
    const now = new Date().toISOString();
    
    // Build dynamic update query based on provided fields
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description || '');
    }
    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date || null);
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?');
      params.push(data.priority);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
      // Set completed_at when marking as completed
      if (data.status === 'completed') {
        updates.push('completed_at = ?');
        params.push(now);
        updates.push('progress = ?');
        params.push(100);
      } else if (data.status === 'pending') {
        updates.push('completed_at = ?');
        params.push(null);
      }
    }
    if (data.progress !== undefined) {
      updates.push('progress = ?');
      params.push(data.progress);
    }
    // Handle explicit completed_at when set directly (e.g., clearing it when un-completing)
    if ('completed_at' in data && data.status === undefined) {
      updates.push('completed_at = ?');
      params.push(data.completed_at || null);
    }
    if (data.daily_progress !== undefined) {
      updates.push('daily_progress = ?');
      params.push(serializeDailyProgress(data.daily_progress));
    }
    if (data.estimated_time !== undefined) {
      updates.push('estimated_time = ?');
      params.push(data.estimated_time || null);
    }
    if (data.actual_time !== undefined) {
      updates.push('actual_time = ?');
      params.push(data.actual_time || null);
    }
    if (data.goal_id !== undefined) {
      updates.push('goal_id = ?');
      params.push(data.goal_id || null);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags || []));
    }
    if (data.duration_type !== undefined) {
      updates.push('duration_type = ?');
      params.push(data.duration_type);
    }
    if (data.is_paused !== undefined) {
      updates.push('is_paused = ?');
      params.push(data.is_paused ? 1 : 0);
    }
    if (data.paused_at !== undefined) {
      updates.push('paused_at = ?');
      params.push(data.paused_at || null);
    }
    if (data.last_reset_date !== undefined) {
      updates.push('last_reset_date = ?');
      params.push(data.last_reset_date || null);
    }
    
    // Always update timestamp and version
    updates.push('updated_at = ?');
    params.push(now);
    updates.push('version = version + 1');
    
    // Add the ID at the end for the WHERE clause
    params.push(id);
    
    await this.executeTransaction([{
      query: `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    }]);
  }

  async completeTask(id: string, progress = 100): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        UPDATE tasks 
        SET status = 'completed', 
            progress = ?,
            completed_at = ?,
            updated_at = ?,
            version = version + 1
        WHERE id = ?
      `,
      params: [progress, now, now, id]
    }]);
  }

  async deleteTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        UPDATE tasks 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  // Habits CRUD
  async getHabits(filters?: HabitFilters): Promise<Habit[]> {
    let query = `
      SELECT h.*, g.title as goal_title
      FROM habits h
      LEFT JOIN goals g ON h.goal_id = g.id
      WHERE h.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (filters) {
      const conditions = [];
      
      if (filters.frequency) {
        conditions.push('h.frequency = ?');
        params.push(filters.frequency);
      }
      
      if (filters.goalId) {
        conditions.push('h.goal_id = ?');
        params.push(filters.goalId);
      }
      
      if (filters.search) {
        conditions.push('(h.title LIKE ? OR h.description LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }
    }
    
    query += ' ORDER BY h.streak_current DESC, h.consistency_score DESC';
    
    const results = await this.executeQuery<Habit>(query, params);
    return results.map(habit => ({
      ...habit,
      schedule: Array.isArray(habit.schedule) ? habit.schedule : JSON.parse(typeof habit.schedule === 'string' ? habit.schedule : '[]'),
    }));
  }

  async getHabitById(id: string): Promise<Habit | null> {
    const results = await this.executeQuery<Habit>(
      `SELECT h.*, g.title as goal_title 
       FROM habits h 
       LEFT JOIN goals g ON h.goal_id = g.id 
       WHERE h.id = ? AND h.deleted_at IS NULL`,
      [id]
    );
    
    if (results.length === 0) return null;
    
    const habit = results[0];
    return {
      ...habit,
      schedule: Array.isArray(habit.schedule) ? habit.schedule : JSON.parse((habit.schedule as any) || '[]'),
    };
  }

  async getTodaysHabits(): Promise<Habit[]> {
    // Use LOCAL date to ensure consistency with habit completion recording
    const today = getLocalDateString(new Date());
    
    const results = await this.executeQuery<Habit & { today_completed: number }>(
      `SELECT h.*, g.title as goal_title,
              COALESCE(hc.completed, 0) as today_completed
       FROM habits h
       LEFT JOIN goals g ON h.goal_id = g.id
       LEFT JOIN habit_completions hc ON h.id = hc.habit_id AND hc.date = ?
       WHERE h.deleted_at IS NULL
       AND h.frequency IN ('daily', 'weekly', 'monthly')
       ORDER BY h.streak_current DESC`,
      [today]
    );
    
    return results.map((habit: any) => {
      const { today_completed, ...habitRest } = habit;
      return {
        ...habitRest,
        schedule: Array.isArray(habitRest.schedule) ? habitRest.schedule : JSON.parse((habitRest.schedule as any) || '[]'),
        today_completed: today_completed === 1,
      };
    });
  }

  async getHabitCompletions(startDate: string, endDate: string): Promise<HabitCompletion[]> {
    return this.executeQuery<HabitCompletion>(`
      SELECT * FROM habit_completions 
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC
    `, [startDate, endDate]);
  }

  async createHabit(data: CreateHabitDTO): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        INSERT INTO habits (
          id, title, description, frequency, schedule, goal_id,
          streak_current, streak_longest, consistency_score,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 1)
      `,
      params: [
        id,
        data.title,
        data.description || '',
        data.frequency || 'daily',
        JSON.stringify(data.schedule || []),
        data.goal_id || null,
        now,
        now,
      ]
    }]);
    
    return id;
  }

  async updateHabit(id: string, data: UpdateHabitDTO): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        UPDATE habits 
        SET title = ?, description = ?, frequency = ?, schedule = ?, goal_id = ?,
            streak_current = ?, streak_longest = ?, consistency_score = ?,
            updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [
        data.title,
        data.description || '',
        data.frequency || 'daily',
        JSON.stringify(data.schedule || []),
        data.goal_id || null,
        data.streak_current || 0,
        data.streak_longest || 0,
        data.consistency_score || 0,
        now,
        id,
      ]
    }]);
  }

  async markHabitCompleted(habitId: string, completed: boolean): Promise<void> {
    await this.setHabitCompletion(habitId, new Date(), completed);
  }

  /**
   * Sets or removes a habit completion for a specific date.
   * 
   * ANTI-GAMING PROTECTION:
   * - Habit completions can only be set for today or past dates (no future completions)
   * - Uses INSERT OR REPLACE to prevent duplicate entries for same habit/date
   * - Streak is recalculated from actual completion history, not from toggle count
   * - Consistency score is based on 30-day window from database records
   * - All changes are logged via version increment for audit purposes
   * 
   * NOTE: Toggling a habit completion multiple times on the same day does NOT
   * artificially inflate progress - only the final state matters.
   */
  async setHabitCompletion(habitId: string, date: Date | string, completed: boolean): Promise<void> {
    const now = new Date().toISOString();
    // Use LOCAL date to avoid timezone issues where UTC conversion shifts the day
    const today = getLocalDateString(new Date());
    // For the target date, also use local interpretation
    const dateStr = typeof date === 'string' 
      ? date.slice(0, 10) 
      : getLocalDateString(date);

    // INTEGRITY CHECK: Prevent future date completions (no gaming by pre-completing)
    if (dateStr > today) {
      console.warn(`[INTEGRITY] Attempted to set habit completion for future date: ${dateStr}`);
      return; // Silently ignore future completions
    }

    // Get the habit to check creation date
    const habitResult = await this.executeQuery<{ created_at: string; frequency: Habit['frequency'] }>(`
      SELECT created_at, frequency FROM habits WHERE id = ?
    `, [habitId]);

    const habit = habitResult?.[0];
    if (!habit) {
      throw new Error(`Habit ${habitId} not found`);
    }

    const habitCreatedDate = habit.created_at.slice(0, 10); // YYYY-MM-DD format
    const habitFrequency = habit.frequency;

    // Validate: don't allow marking dates before habit creation
    if (dateStr < habitCreatedDate) {
      console.warn(`[HABIT] Cannot mark date before habit creation: ${dateStr} < ${habitCreatedDate}`);
      return;
    }

    if (completed) {
      if (habitFrequency === 'weekly' || habitFrequency === 'monthly') {
        const targetDate = new Date(`${dateStr}T00:00:00`);
        const periodStart = habitFrequency === 'weekly'
          ? startOfWeek(targetDate, { weekStartsOn: 1 })
          : startOfMonth(targetDate);
        const periodEnd = habitFrequency === 'weekly'
          ? endOfWeek(targetDate, { weekStartsOn: 1 })
          : endOfMonth(targetDate);
        const periodStartStr = getLocalDateString(periodStart);
        const periodEndStr = getLocalDateString(periodEnd);

        const existingCompletion = await this.executeQuery<{ date: string }>(`
          SELECT date FROM habit_completions
          WHERE habit_id = ? AND completed = 1 AND date BETWEEN ? AND ?
          LIMIT 1
        `, [habitId, periodStartStr, periodEndStr]);

        if (Array.isArray(existingCompletion) && existingCompletion.length > 0) {
          return;
        }
      }

      // INSERT OR REPLACE ensures only ONE record per habit/date combination
      // This prevents gaming by rapid toggling - only final state counts
      await this.executeQuery(`
        INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed, notes, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?)
      `, [crypto.randomUUID(), habitId, dateStr, 1, now]);
    } else {
      await this.executeQuery(`
        DELETE FROM habit_completions 
        WHERE habit_id = ? AND date = ?
      `, [habitId, dateStr]);
    }

    // Get all completions from habit creation date onward (enforce creation date boundary)
    const completionRows = await this.executeQuery<{ date: string }>(`
      SELECT date FROM habit_completions 
      WHERE habit_id = ? AND completed = 1 AND date >= ?
      ORDER BY date DESC
    `, [habitId, habitCreatedDate]);

    const habitCompletionHistory: SharedHabitCompletion[] = (Array.isArray(completionRows) ? completionRows : [])
      .filter((row) => row.date)
      .map((row) => ({
        id: '',
        habit_id: habitId,
        date: row.date.slice(0, 10),
        completed: true,
        notes: null,
        created_at: '',
        updated_at: '',
      }));

    const habitForStreaks = {
      id: habitId,
      frequency: habitFrequency,
      schedule: [],
      created_at: habit.created_at,
      updated_at: habit.created_at,
      title: '',
      description: '',
      goal_id: undefined,
      streak_current: 0,
      streak_longest: 0,
      consistency_score: 0,
    } as SharedHabit;

    const { current: currentStreak, longest: longestStreak } = calculateHabitStreaks(
      habitForStreaks,
      habitCompletionHistory
    );

    // Calculate consistency: count completions from creation date to 30 days ago (or creation date, whichever is later)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo);
    
    // The calculation window starts from the later of: habit creation date or 30 days ago
    const consistencyStartDate = habitCreatedDate > thirtyDaysAgoStr ? habitCreatedDate : thirtyDaysAgoStr;

    const consistencyResult = await this.executeQuery<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM habit_completions 
      WHERE habit_id = ? 
      AND completed = 1 
      AND date >= ? AND date <= ?
    `, [habitId, consistencyStartDate, today]);

    const consistencyCount = consistencyResult?.[0]?.count || 0;
    
    // Calculate expected days: days from consistency start date to today
    const startDate = new Date(consistencyStartDate);
    const todayDate = new Date();
    const expectedDays = Math.max(1, Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const consistencyScore = Math.min(100, Math.round((consistencyCount / expectedDays) * 100));

    await this.executeQuery(`
      UPDATE habits 
      SET streak_current = ?,
          streak_longest = MAX(?, streak_longest),
          consistency_score = ?,
          updated_at = ?,
          version = version + 1
      WHERE id = ?
    `, [currentStreak, longestStreak, consistencyScore, now, habitId]);
  }

  async deleteHabit(id: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        UPDATE habits 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  // Archive Operations - Soft delete that preserves progress data
  // These methods set deleted_at but keep all historical data intact
  
  async archiveTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE tasks 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  async restoreTask(id: string): Promise<Task | null> {
    const existing = await this.executeQuery<{
      id: string;
      status: Task['status'];
      progress: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
      duration_type?: 'today' | 'continuous';
      daily_progress?: string | Record<string, DailyTaskState> | null;
    }>(`
      SELECT id, status, progress, created_at, updated_at, deleted_at, duration_type, daily_progress
      FROM tasks
      WHERE id = ?
      LIMIT 1
    `, [id])

    const taskToRestore = existing?.[0]
    if (!taskToRestore) {
      return null
    }

    const now = new Date().toISOString();

    const todayKey = getLocalDateString(new Date())
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayKey = getLocalDateString(yesterdayDate)

    let nextDailyProgress = normalizeDailyProgressFromDb(taskToRestore.daily_progress, {
      created_at: taskToRestore.created_at,
      updated_at: taskToRestore.updated_at,
      status: taskToRestore.status,
    } as Partial<Task>)

    if ((taskToRestore.duration_type || 'today') === 'continuous') {
      nextDailyProgress[todayKey] = {
        progress: taskToRestore.progress ?? 0,
        status: taskToRestore.status ?? 'pending',
        recorded_at: now,
        source: 'restore',
      }

      const deletedDayKey = taskToRestore.deleted_at
        ? getLocalDateString(new Date(taskToRestore.deleted_at))
        : null

      if (deletedDayKey === todayKey) {
        const existingYesterday = nextDailyProgress[yesterdayKey]
        nextDailyProgress[yesterdayKey] = {
          progress: existingYesterday?.progress ?? taskToRestore.progress ?? 0,
          status: existingYesterday?.status ?? taskToRestore.status ?? 'pending',
          recorded_at: existingYesterday?.recorded_at ?? now,
          source: 'restore',
        }
      }
    }

    await this.executeTransaction([{
      query: `
        UPDATE tasks 
        SET deleted_at = NULL,
            daily_progress = ?,
            updated_at = ?,
            version = version + 1
        WHERE id = ?
      `,
      params: [serializeDailyProgress(nextDailyProgress), now, id]
    }]);
    return this.getTaskById(id);
  }

  async archiveHabit(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE habits 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  async restoreHabit(id: string): Promise<Habit | null> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE habits 
        SET deleted_at = NULL, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, id]
    }]);
    return this.getHabitById(id);
  }

  async archiveGoal(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE goals 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  async restoreGoal(id: string): Promise<Goal | null> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE goals 
        SET deleted_at = NULL, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, id]
    }]);
    return this.getGoalById(id);
  }

  async archiveNote(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE notes 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  async restoreNote(id: string): Promise<Note | null> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE notes 
        SET deleted_at = NULL, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, id]
    }]);
    return this.getNoteById(id);
  }

  // Permanently delete (for archive page's permanent delete action)
  async permanentlyDeleteTask(id: string, options?: { deleteHistory?: boolean }): Promise<void> {
    const shouldDeleteHistory = options?.deleteHistory === true
    const now = new Date().toISOString()

    if (shouldDeleteHistory) {
      await this.executeTransaction([
        {
          query: `DELETE FROM checklist_items WHERE task_id = ?`,
          params: [id]
        },
        {
          query: `DELETE FROM time_blocks WHERE task_id = ?`,
          params: [id]
        },
        {
          query: `DELETE FROM notes WHERE task_id = ?`,
          params: [id]
        },
        {
          query: `DELETE FROM tasks WHERE id = ?`,
          params: [id]
        }
      ])
      return
    }

    await this.executeTransaction([{
      query: `
        UPDATE tasks
        SET title = ?,
            description = '',
            due_date = NULL,
            estimated_time = NULL,
            actual_time = NULL,
            recurrence_rule = NULL,
            project_id = NULL,
            goal_id = NULL,
            parent_task_id = NULL,
            tags = '[]',
            updated_at = ?,
            version = version + 1
        WHERE id = ?
      `,
      params: [TASK_METADATA_DELETED_SENTINEL, now, id]
    }])
  }

  async permanentlyDeleteHabit(id: string): Promise<void> {
    // Also delete associated completions
    await this.executeTransaction([
      { query: `DELETE FROM habit_completions WHERE habit_id = ?`, params: [id] },
      { query: `DELETE FROM habits WHERE id = ?`, params: [id] }
    ]);
  }

  async permanentlyDeleteGoal(id: string): Promise<void> {
    await this.executeTransaction([{
      query: `DELETE FROM goals WHERE id = ?`,
      params: [id]
    }]);
  }

  async permanentlyDeleteNote(id: string): Promise<void> {
    await this.executeTransaction([{
      query: `DELETE FROM notes WHERE id = ?`,
      params: [id]
    }]);
  }

  // Review archive methods
  async restoreReview(id: string): Promise<Review | null> {
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE reviews 
        SET deleted_at = NULL, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, id]
    }]);
    return this.getReviewById(id);
  }

  async permanentlyDeleteReview(id: string): Promise<void> {
    await this.executeTransaction([{
      query: `DELETE FROM reviews WHERE id = ?`,
      params: [id]
    }]);
  }

  // Get archived items for the archive page
  async getArchivedItems(): Promise<{
    tasks: Task[];
    habits: Habit[];
    goals: Goal[];
    notes: Note[];
    reviews: Review[];
  }> {
    const [tasks, habits, goals, notes, reviews] = await Promise.all([
      this.executeQuery<Task>(`
        SELECT t.*, g.title as goal_title 
        FROM tasks t
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE t.deleted_at IS NOT NULL
          AND t.title != ?
        ORDER BY t.deleted_at DESC
      `, [TASK_METADATA_DELETED_SENTINEL]),
      this.executeQuery<Habit>(`
        SELECT h.*, g.title as goal_title 
        FROM habits h
        LEFT JOIN goals g ON h.goal_id = g.id
        WHERE h.deleted_at IS NOT NULL
        ORDER BY h.deleted_at DESC
      `),
      this.executeQuery<Goal>(`
        SELECT * FROM goals 
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `),
      this.executeQuery<Note>(`
        SELECT n.*, g.title as goal_title, t.title as task_title 
        FROM notes n
        LEFT JOIN goals g ON n.goal_id = g.id
        LEFT JOIN tasks t ON n.task_id = t.id
        WHERE n.deleted_at IS NOT NULL
        ORDER BY n.deleted_at DESC
      `),
      this.executeQuery<any>(`
        SELECT * FROM reviews 
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `)
    ]);

    return {
      tasks: tasks.map(task => ({
        ...task,
        tags: Array.isArray(task.tags) ? task.tags : JSON.parse(typeof task.tags === 'string' ? task.tags : '[]'),
        daily_progress: normalizeDailyProgressFromDb((task as any).daily_progress, task),
      })),
      habits: habits.map(habit => ({
        ...habit,
        schedule: Array.isArray(habit.schedule) ? habit.schedule : JSON.parse(typeof habit.schedule === 'string' ? habit.schedule : '[]'),
      })),
      goals: goals.map((goal: any) => ({
        ...goal,
        tags: Array.isArray(goal.tags) ? goal.tags : JSON.parse(typeof goal.tags === 'string' ? goal.tags : '[]'),
      })),
      notes: notes.map(note => ({
        ...note,
        tags: Array.isArray(note.tags) ? note.tags : JSON.parse(typeof note.tags === 'string' ? note.tags : '[]'),
      })),
      reviews: reviews.map(review => this.parseReview(review)),
    };
  }

  // Get archive statistics
  async getArchiveStats(): Promise<{
    totalArchived: number;
    tasksArchived: number;
    habitsArchived: number;
    goalsArchived: number;
    notesArchived: number;
  }> {
    const results = await this.executeQuery<{
      tasks: number;
      habits: number;
      goals: number;
      notes: number;
    }>(`
      SELECT 
        (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NOT NULL AND title != ?) as tasks,
        (SELECT COUNT(*) FROM habits WHERE deleted_at IS NOT NULL) as habits,
        (SELECT COUNT(*) FROM goals WHERE deleted_at IS NOT NULL) as goals,
        (SELECT COUNT(*) FROM notes WHERE deleted_at IS NOT NULL) as notes
    `, [TASK_METADATA_DELETED_SENTINEL]);

    const stats = results[0] || { tasks: 0, habits: 0, goals: 0, notes: 0 };
    return {
      totalArchived: stats.tasks + stats.habits + stats.goals + stats.notes,
      tasksArchived: stats.tasks,
      habitsArchived: stats.habits,
      goalsArchived: stats.goals,
      notesArchived: stats.notes,
    };
  }

  // Clear all archived items (permanent delete)
  async clearArchive(): Promise<void> {
    await this.executeTransaction([
      { query: `DELETE FROM tasks WHERE deleted_at IS NOT NULL`, params: [] },
      { query: `DELETE FROM habit_completions WHERE habit_id IN (SELECT id FROM habits WHERE deleted_at IS NOT NULL)`, params: [] },
      { query: `DELETE FROM habits WHERE deleted_at IS NOT NULL`, params: [] },
      { query: `DELETE FROM goals WHERE deleted_at IS NOT NULL`, params: [] },
      { query: `DELETE FROM notes WHERE deleted_at IS NOT NULL`, params: [] },
      { query: `DELETE FROM reviews WHERE deleted_at IS NOT NULL`, params: [] },
    ]);
  }

  // Notes CRUD
  async getNotes(filters?: NoteFilters): Promise<Note[]> {
    let query = `
      SELECT n.*, g.title as goal_title, t.title as task_title
      FROM notes n
      LEFT JOIN goals g ON n.goal_id = g.id
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (filters) {
      const conditions = [];
      
      if (filters.type) {
        conditions.push('n.type = ?');
        params.push(filters.type);
      }
      
      if (filters.goalId) {
        conditions.push('n.goal_id = ?');
        params.push(filters.goalId);
      }
      
      if (filters.taskId) {
        conditions.push('n.task_id = ?');
        params.push(filters.taskId);
      }
      
      if (filters.search) {
        conditions.push('(n.title LIKE ? OR n.content LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }
    }
    
    query += ' ORDER BY n.updated_at DESC';
    
    const results = await this.executeQuery<Note>(query, params);
    return results.map((note: any) => ({
      ...note,
      tags: Array.isArray(note.tags) ? note.tags : JSON.parse(typeof note.tags === 'string' ? note.tags : '[]'),
      pinned: note.pinned === 1 || note.pinned === true,
    }));
  }

  async getNoteById(id: string): Promise<Note | null> {
    const results = await this.executeQuery<Note>(
      `SELECT n.*, g.title as goal_title, t.title as task_title 
       FROM notes n 
       LEFT JOIN goals g ON n.goal_id = g.id 
       LEFT JOIN tasks t ON n.task_id = t.id 
       WHERE n.id = ? AND n.deleted_at IS NULL`,
      [id]
    );
    
    if (results.length === 0) return null;
    
    const note = results[0] as any;
    return {
      ...note,
      tags: Array.isArray(note.tags) ? note.tags : JSON.parse(typeof note.tags === 'string' ? note.tags : '[]'),
      pinned: note.pinned === 1 || note.pinned === true,
    };
  }

  async createNote(data: CreateNoteDTO): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        INSERT INTO notes (
          id, title, content, type, mood, goal_id, task_id, tags, pinned,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      params: [
        id,
        data.title,
        data.content,
        data.type || 'free',
        data.mood || null,
        data.goal_id || null,
        data.task_id || null,
        JSON.stringify(data.tags || []),
        data.pinned ? 1 : 0,
        now,
        now,
      ]
    }]);
    
    return id;
  }

  async updateNote(id: string, data: UpdateNoteDTO): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        UPDATE notes 
        SET title = ?, content = ?, type = ?, mood = ?, 
            goal_id = ?, task_id = ?, tags = ?, pinned = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [
        data.title,
        data.content,
        data.type || 'free',
        data.mood || null,
        data.goal_id || null,
        data.task_id || null,
        JSON.stringify(data.tags || []),
        data.pinned !== undefined ? (data.pinned ? 1 : 0) : 0,
        now,
        id,
      ]
    }]);
  }

  async deleteNote(id: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        UPDATE notes 
        SET deleted_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, now, id]
    }]);
  }

  // Time Blocks CRUD
  async getTimeBlocks(filters?: TimeBlockFilters): Promise<TimeBlock[]> {
    let query = `
      SELECT tb.*, t.title as task_title, h.title as habit_title
      FROM time_blocks tb
      LEFT JOIN tasks t ON tb.task_id = t.id
      LEFT JOIN habits h ON tb.habit_id = h.id
      WHERE tb.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (filters) {
      const conditions = [];
      
      if (filters.startDate) {
        conditions.push('tb.start_time >= ?');
        params.push(filters.startDate);
      }
      
      if (filters.endDate) {
        conditions.push('tb.start_time <= ?');
        params.push(filters.endDate);
      }
      
      if (filters.taskId) {
        conditions.push('tb.task_id = ?');
        params.push(filters.taskId);
      }
      
      if (filters.habitId) {
        conditions.push('tb.habit_id = ?');
        params.push(filters.habitId);
      }
      
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }
    }
    
    query += ' ORDER BY tb.start_time DESC';
    
    return this.executeQuery<TimeBlock>(query, params);
  }

  async createTimeBlock(data: CreateTimeBlockDTO): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        INSERT INTO time_blocks (
          id, task_id, habit_id, start_time, end_time, duration, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        id,
        data.task_id || null,
        data.habit_id || null,
        data.start_time,
        data.end_time,
        data.duration,
        data.notes || null,
        now,
        now,
      ]
    }]);
    
    return id;
  }

  // Dashboard Statistics
  async getDashboardStats() {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    const todayDate = new Date().toISOString().split('T')[0];
    const todayKey = getLocalDateString(new Date())

    type RawDashboardTaskRecord = {
      id: string
      due_date?: string | null
      status: Task['status']
      progress: number
      created_at: string
      updated_at: string
      is_paused?: number | boolean
      daily_progress?: string | Record<string, DailyTaskState> | null
      deleted_at?: string | null
    }

    const toLocalDayKey = (isoLike: string | null | undefined): string => {
      if (!isoLike) return todayKey
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoLike)) return isoLike
      return getLocalDateString(new Date(isoLike))
    }

    const isPausedOnDay = (
      task: RawDashboardTaskRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): boolean => {
      const historyEntry = normalizedHistory[dayKey]
      if (historyEntry) return historyEntry.source === 'paused'
      const rawIsPaused = task.is_paused
      const isPausedNow = rawIsPaused === 1 || rawIsPaused === true
      return dayKey === todayKey && isPausedNow
    }

    const getTaskLifecycleEndKey = (task: RawDashboardTaskRecord): string => {
      if (!task.deleted_at) return todayKey;
      const deletedDay = toLocalDayKey(task.deleted_at);
      return deletedDay < todayKey ? deletedDay : todayKey;
    };

    const makeEntry = (
      task: RawDashboardTaskRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): { progress: number; status: DailyTaskState['status'] } => {
      const historyEntry = normalizedHistory[dayKey]
      if (historyEntry) {
        return { progress: historyEntry.progress ?? 0, status: historyEntry.status ?? 'pending' }
      }

      if (dayKey === todayKey) {
        return {
          progress: task.progress ?? 0,
          status: task.status ?? 'pending',
        }
      }

      return inferTaskStateForDay(task, dayKey, normalizedHistory, todayKey, getTaskLifecycleEndKey)
    }
    
    const queries = [
      // Today's tasks
      {
        query: `
          SELECT COUNT(*) as today_tasks
          FROM tasks 
          WHERE due_date BETWEEN ? AND ?
          AND status != 'completed'
          AND deleted_at IS NULL
        `,
        params: [startOfDay, endOfDay]
      },
      // Active goals
      {
        query: `
          SELECT COUNT(*) as active_goals,
                 AVG(progress) as avg_progress
          FROM goals 
          WHERE status = 'active'
          AND deleted_at IS NULL
        `,
        params: []
      },
      // Habit completions today
      {
        query: `
          SELECT COUNT(*) as completed_habits
          FROM habit_completions hc
          JOIN habits h ON hc.habit_id = h.id
          WHERE hc.date = ?
          AND hc.completed = 1
          AND h.deleted_at IS NULL
        `,
        params: [todayDate]
      },
      // Time tracked today
      {
        query: `
          SELECT SUM(duration) as focus_time_today
          FROM time_blocks 
          WHERE start_time BETWEEN ? AND ?
          AND deleted_at IS NULL
          AND (
            notes IS NULL
            OR (
              notes NOT LIKE 'shortBreak session%'
              AND notes NOT LIKE 'longBreak session%'
            )
          )
        `,
        params: [startOfDay, endOfDay]
      },
      // Overdue task candidates (finalized state evaluated below)
      {
        query: `
          SELECT id, due_date, status, progress, created_at, updated_at, is_paused, daily_progress, deleted_at
          FROM tasks 
          WHERE due_date IS NOT NULL
          AND deleted_at IS NULL
        `,
        params: []
      }
    ];
    
    const results = await Promise.all(
      queries.map(q => this.executeQuery<any>(q.query, q.params))
    );
    
    const overdueTasks = (results[4] as RawDashboardTaskRecord[]).filter((task) => {
      if (!task.due_date) return false
      const dueDay = toLocalDayKey(task.due_date)
      if (!isFinalizedPastDay(dueDay, todayKey)) return false

      const createdDay = toLocalDayKey(task.created_at)
      if (createdDay > dueDay) return false

      const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
        ...task,
        created_at: task.created_at,
        updated_at: task.updated_at,
        status: task.status,
      } as Partial<Task>)

      if (isPausedOnDay(task, dueDay, normalizedHistory)) return false

      const entry = makeEntry(task, dueDay, normalizedHistory)
      return isSkippedOrEmptyState(entry)
    }).length

    return {
      today_tasks: results[0][0]?.today_tasks || 0,
      active_goals: results[1][0]?.active_goals || 0,
      avg_progress: results[1][0]?.avg_progress || 0,
      completed_habits: results[2][0]?.completed_habits || 0,
      focus_time_today: results[3][0]?.focus_time_today || 0,
      overdue_tasks: overdueTasks,
    };
  }

  // User Preferences
  async getUserPreferences(): Promise<UserPreferences> {
    const results = await this.executeQuery<UserPreferences>(
      'SELECT * FROM user_preferences WHERE id = "default"'
    );
    
    if (results.length === 0) {
      // Return default preferences
      return {
        id: 'default',
        theme: 'system',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        week_start: 'monday',
        language: 'en',
        compact_mode: false,
        animations_enabled: true,
        sound_enabled: true,
        sync_enabled: false,
        sync_provider: '',
        sync_endpoint: '',
        sync_api_key: '',
        sync_interval: 5,
        encryption_key: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    
    return results[0];
  }

  async updateUserPreferences(data: Partial<UserPreferences>): Promise<void> {
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        INSERT OR REPLACE INTO user_preferences (
          id, theme, timezone, week_start, language, compact_mode,
          animations_enabled, sound_enabled, sync_enabled, sync_provider,
          sync_endpoint, sync_api_key, sync_interval, encryption_key,
          created_at, updated_at
        ) VALUES (
          'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
          COALESCE((SELECT created_at FROM user_preferences WHERE id = 'default'), ?),
          ?
        )
      `,
      params: [
        data.theme || 'system',
        data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        data.week_start || 'monday',
        data.language || 'en',
        data.compact_mode || false,
        data.animations_enabled ?? true,
        data.sound_enabled ?? true,
        data.sync_enabled || false,
        data.sync_provider || '',
        data.sync_endpoint || '',
        data.sync_api_key || '',
        data.sync_interval || 5,
        data.encryption_key || '',
        now,
        now,
      ]
    }]);
  }

  // Search
  async search(query: string, types: string[] = ['goals', 'tasks', 'habits', 'notes']): Promise<any[]> {
    const searchTerm = `%${query}%`;
    const results: any[] = [];
    
    if (types.includes('goals')) {
      const goals = await this.executeQuery(
        `SELECT 'goal' as type, id, title, description, created_at, progress
         FROM goals 
         WHERE (title LIKE ? OR description LIKE ?) 
         AND deleted_at IS NULL
         LIMIT 10`,
        [searchTerm, searchTerm]
      );
      results.push(...goals);
    }
    
    if (types.includes('tasks')) {
      const tasks = await this.executeQuery(
        `SELECT 'task' as type, id, title, description, created_at, status, priority
         FROM tasks 
         WHERE (title LIKE ? OR description LIKE ?) 
         AND deleted_at IS NULL
         LIMIT 10`,
        [searchTerm, searchTerm]
      );
      results.push(...tasks);
    }
    
    if (types.includes('habits')) {
      const habits = await this.executeQuery(
        `SELECT 'habit' as type, id, title, description, created_at, streak_current
         FROM habits 
         WHERE (title LIKE ? OR description LIKE ?) 
         AND deleted_at IS NULL
         LIMIT 10`,
        [searchTerm, searchTerm]
      );
      results.push(...habits);
    }
    
    if (types.includes('notes')) {
      const notes = await this.executeQuery(
        `SELECT 'note' as type, id, title, content as description, created_at, type as note_type
         FROM notes 
         WHERE (title LIKE ? OR content LIKE ?) 
         AND deleted_at IS NULL
         LIMIT 10`,
        [searchTerm, searchTerm]
      );
      results.push(...notes);
    }
    
    return results;
  }

  // Export/Import
  async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const data = {
      timestamp: new Date().toISOString(),
      version: 1,
      goals: await this.getGoals(),
      tasks: await this.getTasks(),
      habits: await this.getHabits(),
      notes: await this.getNotes(),
      timeBlocks: await this.getTimeBlocks(),
      preferences: await this.getUserPreferences(),
    };
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Simple CSV export
      const csvLines = ['Type,ID,Title,Description,Created At'];
      
      data.goals.forEach(goal => {
        csvLines.push(`goal,${goal.id},"${goal.title}","${goal.description}",${goal.created_at}`);
      });
      
      data.tasks.forEach(task => {
        csvLines.push(`task,${task.id},"${task.title}","${task.description}",${task.created_at}`);
      });
      
      return csvLines.join('\n');
    }
  }

  async importData(data: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    // Note: In a real implementation, this would be more complex
    // with transaction rollback and conflict resolution
    console.log('Importing data:', { format, dataLength: data.length });
    // Implementation would parse data and insert into database
  }

  // Backup operations
  async createBackup(): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    return window.electronAPI.createBackup();
  }

  async restoreBackup(backupId: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    return window.electronAPI.restoreBackup(backupId);
  }

  async listBackups(): Promise<Backup[]> {
    if (!window.electronAPI) {
      return [];
    }
    
    return window.electronAPI.listBackups();
  }

  // Utility methods
  async getTaskTabStats(): Promise<TaskTabStatsSnapshot> {
    type RawTaskStatsRecord = {
      id: string;
      title: string;
      priority: Task['priority'];
      status: Task['status'];
      progress: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
      is_paused?: number | boolean;
      duration_type?: 'today' | 'continuous';
      daily_progress?: string | Record<string, DailyTaskState> | null;
    };

    const completionFactor = (progress: number | undefined | null): number => {
      const value = Math.max(0, Math.min(progress ?? 0, 100));
      if (value >= 100) return 1;
      if (value >= 75) return 0.75;
      if (value >= 50) return 0.5;
      if (value >= 25) return 0.25;
      return 0;
    };

    const priorityWeight = (priority: Task['priority'] | undefined): number => {
      if (priority === 'high') return 3;
      if (priority === 'medium') return 2;
      if (priority === 'low') return 1;
      return 2;
    };

    const todayDate = new Date();
    const todayKey = getLocalDateString(todayDate);

    const weekStartDate = new Date(todayDate);
    const dayOfWeek = weekStartDate.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    weekStartDate.setDate(weekStartDate.getDate() - daysSinceMonday);
    const weekStartKey = getLocalDateString(weekStartDate);

    const previousWeekStartDate = new Date(todayDate);
    previousWeekStartDate.setDate(weekStartDate.getDate() - 7);
    const previousWeekStartKey = getLocalDateString(previousWeekStartDate);
    const previousWeekEndDate = new Date(todayDate);
    previousWeekEndDate.setDate(weekStartDate.getDate() - 1);
    const previousWeekEndKey = getLocalDateString(previousWeekEndDate);

    const monthStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const monthEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
    const monthStartKey = getLocalDateString(monthStartDate);
    const monthEndKey = getLocalDateString(monthEndDate);

    const previousMonthStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
    const previousMonthEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
    const previousMonthStartKey = getLocalDateString(previousMonthStartDate);
    const previousMonthEndKey = getLocalDateString(previousMonthEndDate);

    const toLocalDayKey = (isoLike: string | null | undefined): string => {
      if (!isoLike) return todayKey;
      return getLocalDateString(new Date(isoLike));
    };

    const inRange = (dayKey: string, startKey: string, endKey: string): boolean => {
      return dayKey >= startKey && dayKey <= endKey;
    };

    const getTaskLifecycleEndKey = (task: RawTaskStatsRecord): string => {
      if (!task.deleted_at) return todayKey;
      const deletedDay = toLocalDayKey(task.deleted_at);
      return deletedDay < todayKey ? deletedDay : todayKey;
    };

    const makeEntry = (
      task: RawTaskStatsRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): { progress: number; status: DailyTaskState['status'] } => {
      const historyEntry = normalizedHistory[dayKey];
      if (historyEntry) {
        return { progress: historyEntry.progress ?? 0, status: historyEntry.status ?? 'pending' };
      }

      if (dayKey === todayKey) {
        return {
          progress: task.progress ?? 0,
          status: task.status ?? 'pending',
        };
      }

      return inferTaskStateForDay(task, dayKey, normalizedHistory, todayKey, getTaskLifecycleEndKey);
    };

    const isPausedOnDay = (
      task: RawTaskStatsRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): boolean => {
      const historyEntry = normalizedHistory[dayKey];
      if (historyEntry) {
        return historyEntry.source === 'paused';
      }

      const rawIsPaused = task.is_paused;
      const isPausedNow = rawIsPaused === 1 || rawIsPaused === true;
      return dayKey === todayKey && isPausedNow;
    };

    const buildDayKeys = (startKey: string, endKey: string): string[] => {
      const keys: string[] = [];
      const cursor = new Date(startKey);
      const end = new Date(endKey);

      while (cursor.getTime() <= end.getTime()) {
        keys.push(getLocalDateString(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      return keys;
    };

    const computePeriodStats = (
      taskRecords: RawTaskStatsRecord[],
      startKey: string,
      endKey: string
    ): TaskPeriodStats => {
      let total = 0;
      let completed = 0;
      let partially = 0;
      let skipped = 0;
      let plannedWeight = 0;
      let earnedWeight = 0;

      taskRecords.forEach((task) => {
        const createdDay = toLocalDayKey(task.created_at);
        const lifecycleEndKey = getTaskLifecycleEndKey(task);
        if (createdDay > lifecycleEndKey) {
          return;
        }
        const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
          ...task,
          created_at: task.created_at,
          updated_at: task.updated_at,
          status: task.status,
        } as Partial<Task>);

        const historyKeysInRange = Object.keys(normalizedHistory)
          .filter((key) => inRange(key, startKey, endKey) && key <= lifecycleEndKey)
          .sort();

        const occurrenceKeys = new Set<string>();

        if ((task.duration_type || 'today') === 'continuous') {
          const effectiveStartKey = createdDay > startKey ? createdDay : startKey;
          const effectiveEndKey = [endKey, todayKey, lifecycleEndKey].sort()[0];

          if (effectiveStartKey <= effectiveEndKey) {
            buildDayKeys(effectiveStartKey, effectiveEndKey).forEach((dayKey) => occurrenceKeys.add(dayKey));
          }
        } else if (inRange(createdDay, startKey, endKey) && createdDay <= lifecycleEndKey) {
          occurrenceKeys.add(createdDay);
        }

        historyKeysInRange.forEach((dayKey) => occurrenceKeys.add(dayKey));

        if (occurrenceKeys.size === 0) {
          return;
        }

        Array.from(occurrenceKeys).forEach((dayKey) => {
          const entry = makeEntry(task, dayKey, normalizedHistory);
          if (isPausedOnDay(task, dayKey, normalizedHistory)) {
            return;
          }
          const weight = priorityWeight(task.priority);

          total += 1;
          plannedWeight += weight;
          earnedWeight += weight * completionFactor(entry.progress);

          if (entry.progress >= 100) {
            completed += 1;
          } else if (entry.progress > 0) {
            partially += 1;
          }

          // Skipped/overdue penalties apply only after date rollover.
          // Never penalize the current day.
          if (isFinalizedPastDay(dayKey, todayKey) && isSkippedOrEmptyState(entry)) {
            skipped += 1
          }
        });
      });

      const weightedProgress = plannedWeight > 0
        ? Math.round((earnedWeight / plannedWeight) * 100)
        : 0;

      return {
        total,
        completed,
        partially,
        skipped,
        plannedWeight,
        earnedWeight,
        weightedProgress,
      };
    };

    const computeAllTimeRange = (taskRecords: RawTaskStatsRecord[]): { startKey: string; endKey: string } => {
      let earliestKey = todayKey;

      taskRecords.forEach((task) => {
        const createdDay = toLocalDayKey(task.created_at);
        if (createdDay < earliestKey) {
          earliestKey = createdDay;
        }

        const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
          ...task,
          created_at: task.created_at,
          updated_at: task.updated_at,
          status: task.status,
        } as Partial<Task>);

        Object.keys(normalizedHistory).forEach((dayKey) => {
          if (dayKey < earliestKey) {
            earliestKey = dayKey;
          }
        });
      });

      return {
        startKey: earliestKey,
        endKey: todayKey,
      };
    };

    const taskRecords = await this.executeQuery<RawTaskStatsRecord>(`
      SELECT id, title, priority, status, progress, created_at, updated_at, deleted_at, is_paused, duration_type, daily_progress
      FROM tasks
    `);

    // Keep all task records (including UI-only metadata-deleted tasks) in historical stats.
    // UI-only deletion must not remove historical weekly/monthly/health/weight contributions.
    const scopedTaskRecords = taskRecords

    const activeTaskRecords = scopedTaskRecords.filter((task) => !task.deleted_at)

    const activeTodayTasks = activeTaskRecords.filter((task) => {
      if (task.deleted_at) return false;
      const createdDay = toLocalDayKey(task.created_at);
      const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
        ...task,
        created_at: task.created_at,
        updated_at: task.updated_at,
        status: task.status,
      } as Partial<Task>);
      if (isPausedOnDay(task, todayKey, normalizedHistory)) return false;
      if ((task.duration_type || 'today') === 'continuous') {
        return createdDay <= todayKey;
      }
      return createdDay === todayKey;
    });

    const today = activeTodayTasks.reduce(
      (acc, task) => {
        const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
          ...task,
          created_at: task.created_at,
          updated_at: task.updated_at,
          status: task.status,
        } as Partial<Task>);

        const entry = makeEntry(task, todayKey, normalizedHistory);
        const weight = priorityWeight(task.priority);

        acc.total += 1;
        if (entry.progress >= 100) {
          acc.completed += 1;
        } else if (entry.progress > 0) {
          acc.partially += 1;
        }
        // Today's section has no live skipped penalties; skipped is only post-rollover.
        acc.plannedWeight += weight;
        acc.earnedWeight += weight * completionFactor(entry.progress);

        return acc;
      },
      { total: 0, completed: 0, partially: 0, skipped: 0, plannedWeight: 0, earnedWeight: 0, weightedProgress: 0 }
    );

    today.weightedProgress = today.plannedWeight > 0
      ? Math.round((today.earnedWeight / today.plannedWeight) * 100)
      : 0;

    const weekly = computePeriodStats(scopedTaskRecords, weekStartKey, todayKey);
    const previousWeekly = computePeriodStats(scopedTaskRecords, previousWeekStartKey, previousWeekEndKey);
    const monthly = computePeriodStats(scopedTaskRecords, monthStartKey, monthEndKey);
    const previousMonthly = computePeriodStats(scopedTaskRecords, previousMonthStartKey, previousMonthEndKey);

    const healthRange = computeAllTimeRange(taskRecords)
    const health = computePeriodStats(taskRecords, healthRange.startKey, healthRange.endKey)

    return {
      today,
      weekly,
      previousWeekly,
      monthly,
      previousMonthly,
      health,
    };
  }

  async getTaskRangeAnalyticsSnapshot(startDate: string, endDate: string): Promise<TaskRangeAnalyticsSnapshot> {
    type RawTaskStatsRecord = {
      id: string;
      title: string;
      due_date?: string | null;
      priority: Task['priority'];
      status: Task['status'];
      progress: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
      is_paused?: number | boolean;
      duration_type?: 'today' | 'continuous';
      daily_progress?: string | Record<string, DailyTaskState> | null;
    };

    const completionFactor = (progress: number | undefined | null): number => {
      const value = Math.max(0, Math.min(progress ?? 0, 100));
      if (value >= 100) return 1;
      if (value >= 75) return 0.75;
      if (value >= 50) return 0.5;
      if (value >= 25) return 0.25;
      return 0;
    };

    const priorityWeight = (priority: Task['priority'] | undefined): number => {
      if (priority === 'high') return 3;
      if (priority === 'medium') return 2;
      if (priority === 'low') return 1;
      return 2;
    };

    const normalizeDayKey = (value: string, fallback: string): string => {
      if (!value) return fallback;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      return getLocalDateString(new Date(value));
    };

    const todayKey = getLocalDateString(new Date());
    let normalizedStart = normalizeDayKey(startDate, todayKey);
    let normalizedEnd = normalizeDayKey(endDate, todayKey);
    if (normalizedStart > normalizedEnd) {
      const tmp = normalizedStart;
      normalizedStart = normalizedEnd;
      normalizedEnd = tmp;
    }

    const toLocalDayKey = (isoLike: string | null | undefined): string => {
      if (!isoLike) return todayKey;
      return getLocalDateString(new Date(isoLike));
    };

    const inRange = (dayKey: string, startKey: string, endKey: string): boolean => {
      return dayKey >= startKey && dayKey <= endKey;
    };

    const getTaskLifecycleEndKey = (task: RawTaskStatsRecord): string => {
      if (!task.deleted_at) return todayKey;
      const deletedDay = toLocalDayKey(task.deleted_at);
      return deletedDay < todayKey ? deletedDay : todayKey;
    };

    const makeEntry = (
      task: RawTaskStatsRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): { progress: number; status: DailyTaskState['status'] } => {
      const historyEntry = normalizedHistory[dayKey];
      if (historyEntry) {
        return { progress: historyEntry.progress ?? 0, status: historyEntry.status ?? 'pending' };
      }

      if (dayKey === todayKey) {
        return {
          progress: task.progress ?? 0,
          status: task.status ?? 'pending',
        };
      }

      return inferTaskStateForDay(task, dayKey, normalizedHistory, todayKey, getTaskLifecycleEndKey);
    };

    const isPausedOnDay = (
      task: RawTaskStatsRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): boolean => {
      const historyEntry = normalizedHistory[dayKey];
      if (historyEntry) {
        return historyEntry.source === 'paused';
      }

      const rawIsPaused = task.is_paused;
      const isPausedNow = rawIsPaused === 1 || rawIsPaused === true;
      return dayKey === todayKey && isPausedNow;
    };

    const buildDayKeys = (startKey: string, endKey: string): string[] => {
      const keys: string[] = [];
      const cursor = new Date(startKey);
      const end = new Date(endKey);

      while (cursor.getTime() <= end.getTime()) {
        keys.push(getLocalDateString(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      return keys;
    };

    const computePeriodStats = (
      taskRecords: RawTaskStatsRecord[],
      startKey: string,
      endKey: string
    ): TaskPeriodStats => {
      let total = 0;
      let completed = 0;
      let partially = 0;
      let skipped = 0;
      let plannedWeight = 0;
      let earnedWeight = 0;

      taskRecords.forEach((task) => {
        const createdDay = toLocalDayKey(task.created_at);
        const lifecycleEndKey = getTaskLifecycleEndKey(task);
        if (createdDay > lifecycleEndKey) {
          return;
        }
        const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
          ...task,
          created_at: task.created_at,
          updated_at: task.updated_at,
          status: task.status,
        } as Partial<Task>);

        const historyKeysInRange = Object.keys(normalizedHistory)
          .filter((key) => inRange(key, startKey, endKey) && key <= lifecycleEndKey)
          .sort();

        const occurrenceKeys = new Set<string>();

        if ((task.duration_type || 'today') === 'continuous') {
          const effectiveStartKey = createdDay > startKey ? createdDay : startKey;
          const effectiveEndKey = [endKey, todayKey, lifecycleEndKey].sort()[0];

          if (effectiveStartKey <= effectiveEndKey) {
            buildDayKeys(effectiveStartKey, effectiveEndKey).forEach((dayKey) => occurrenceKeys.add(dayKey));
          }
        } else if (inRange(createdDay, startKey, endKey) && createdDay <= lifecycleEndKey) {
          occurrenceKeys.add(createdDay);
        }

        historyKeysInRange.forEach((dayKey) => occurrenceKeys.add(dayKey));

        if (occurrenceKeys.size === 0) {
          return;
        }

        Array.from(occurrenceKeys).forEach((dayKey) => {
          const entry = makeEntry(task, dayKey, normalizedHistory);
          if (isPausedOnDay(task, dayKey, normalizedHistory)) {
            return;
          }
          const weight = priorityWeight(task.priority);

          total += 1;
          plannedWeight += weight;
          earnedWeight += weight * completionFactor(entry.progress);

          if (entry.progress >= 100) {
            completed += 1;
          } else if (entry.progress > 0) {
            partially += 1;
          }

          if (isFinalizedPastDay(dayKey, todayKey) && isSkippedOrEmptyState(entry)) {
            skipped += 1;
          }
        });
      });

      const weightedProgress = plannedWeight > 0
        ? Math.round((earnedWeight / plannedWeight) * 100)
        : 0;

      return {
        total,
        completed,
        partially,
        skipped,
        plannedWeight,
        earnedWeight,
        weightedProgress,
      };
    };

    const taskRecords = await this.executeQuery<RawTaskStatsRecord>(`
      SELECT id, title, due_date, priority, status, progress, created_at, updated_at, deleted_at, is_paused, duration_type, daily_progress
      FROM tasks
    `);

    const summary = computePeriodStats(taskRecords, normalizedStart, normalizedEnd);

    const createPriorityBucket = (): TaskRangePriorityStats => ({
      total: 0,
      completed: 0,
      plannedWeight: 0,
      earnedWeight: 0,
    });

    const byPriority: TaskRangeAnalyticsSnapshot['byPriority'] = {
      high: createPriorityBucket(),
      medium: createPriorityBucket(),
      low: createPriorityBucket(),
    };

    taskRecords.forEach((task) => {
      const createdDay = toLocalDayKey(task.created_at);
      const lifecycleEndKey = getTaskLifecycleEndKey(task);
      if (createdDay > lifecycleEndKey) return;
      const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
        ...task,
        created_at: task.created_at,
        updated_at: task.updated_at,
        status: task.status,
      } as Partial<Task>);

      const historyKeysInRange = Object.keys(normalizedHistory)
        .filter((key) => inRange(key, normalizedStart, normalizedEnd) && key <= lifecycleEndKey)
        .sort();

      const occurrenceKeys = new Set<string>();
      if ((task.duration_type || 'today') === 'continuous') {
        const effectiveStartKey = createdDay > normalizedStart ? createdDay : normalizedStart;
        const effectiveEndKey = [normalizedEnd, todayKey, lifecycleEndKey].sort()[0];
        if (effectiveStartKey <= effectiveEndKey) {
          buildDayKeys(effectiveStartKey, effectiveEndKey).forEach((dayKey) => occurrenceKeys.add(dayKey));
        }
      } else if (inRange(createdDay, normalizedStart, normalizedEnd) && createdDay <= lifecycleEndKey) {
        occurrenceKeys.add(createdDay);
      }
      historyKeysInRange.forEach((dayKey) => occurrenceKeys.add(dayKey));
      if (occurrenceKeys.size === 0) return;

      const priorityKey: keyof TaskRangeAnalyticsSnapshot['byPriority'] =
        task.priority === 'high' || task.priority === 'low' ? task.priority : 'medium';
      const bucket = byPriority[priorityKey];

      Array.from(occurrenceKeys).forEach((dayKey) => {
        if (isPausedOnDay(task, dayKey, normalizedHistory)) return;
        const entry = makeEntry(task, dayKey, normalizedHistory);
        const weight = priorityWeight(task.priority);
        bucket.total += 1;
        bucket.plannedWeight += weight;
        bucket.earnedWeight += weight * completionFactor(entry.progress);
        if (entry.progress >= 100) bucket.completed += 1;
      });
    });

    const daily = buildDayKeys(normalizedStart, normalizedEnd).map((dayKey) => {
      const dayStats = computePeriodStats(taskRecords, dayKey, dayKey);
      const dayDate = new Date(`${dayKey}T00:00:00`);
      return {
        dateKey: dayKey,
        date: dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        day: dayDate.toLocaleDateString(undefined, { weekday: 'short' }),
        total: dayStats.total,
        completed: dayStats.completed,
        partially: dayStats.partially,
        skipped: dayStats.skipped,
        plannedWeight: dayStats.plannedWeight,
        earnedWeight: dayStats.earnedWeight,
        weightedProgress: dayStats.weightedProgress,
      };
    });

    const overdue = taskRecords.filter((task) => {
      if (!task.due_date) return false;
      const dueDay = toLocalDayKey(task.due_date);
      if (!inRange(dueDay, normalizedStart, normalizedEnd)) return false;
      // No same-day overdue penalties; overdue starts only after rollover.
      if (!isFinalizedPastDay(dueDay, todayKey)) return false;
      const createdDay = toLocalDayKey(task.created_at);
      if (createdDay > dueDay) return false;
      const lifecycleEndKey = getTaskLifecycleEndKey(task);
      if (dueDay > lifecycleEndKey) return false;
      const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
        ...task,
        created_at: task.created_at,
        updated_at: task.updated_at,
        status: task.status,
      } as Partial<Task>);
      if (isPausedOnDay(task, dueDay, normalizedHistory)) return false;
      const entry = makeEntry(task, dueDay, normalizedHistory);
      return isSkippedOrEmptyState(entry);
    }).length;

    return {
      startDate: normalizedStart,
      endDate: normalizedEnd,
      summary,
      overdue,
      byPriority,
      daily,
    };
  }

  async getTaskAnalyticsChartSnapshot(monthDate?: string | Date): Promise<TaskAnalyticsChartSnapshot> {
    type RawTaskStatsRecord = {
      id: string;
      priority: Task['priority'];
      status: Task['status'];
      progress: number;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
      is_paused?: number | boolean;
      duration_type?: 'today' | 'continuous';
      daily_progress?: string | Record<string, DailyTaskState> | null;
    };

    const completionFactor = (progress: number | undefined | null): number => {
      const value = Math.max(0, Math.min(progress ?? 0, 100));
      if (value >= 100) return 1;
      if (value >= 75) return 0.75;
      if (value >= 50) return 0.5;
      if (value >= 25) return 0.25;
      return 0;
    };

    const priorityWeight = (priority: Task['priority'] | undefined): number => {
      if (priority === 'high') return 3;
      if (priority === 'medium') return 2;
      if (priority === 'low') return 1;
      return 2;
    };

    const toLocalDayKey = (isoLike: string | null | undefined): string => {
      if (!isoLike) return getLocalDateString(new Date());
      return getLocalDateString(new Date(isoLike));
    };

    const parseLocalDateKey = (dateKey: string): Date => {
      const parts = safeToDayKeyParts(dateKey);
      if (!parts) {
        return new Date(dateKey);
      }
      const [year, month, day] = parts;
      if (!year || !month || !day) {
        return new Date(dateKey);
      }
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    };

    const resolveMonthDate = (value?: string | Date): Date => {
      if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
      }

      if (typeof value === 'string') {
        const monthOnly = value.match(/^(\d{4})-(\d{2})$/);
        if (monthOnly) {
          return new Date(Number(monthOnly[1]), Number(monthOnly[2]) - 1, 1, 0, 0, 0, 0);
        }

        const fullDay = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (fullDay) {
          return new Date(Number(fullDay[1]), Number(fullDay[2]) - 1, Number(fullDay[3]), 0, 0, 0, 0);
        }

        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
        }
      }

      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    };

    const inRange = (dayKey: string, startKey: string, endKey: string): boolean => {
      return dayKey >= startKey && dayKey <= endKey;
    };

    const getDayFromDateKey = (dateKey: string): string => {
      const date = parseLocalDateKey(dateKey);
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    };

    const getMonthLabel = (date: Date): string => {
      return date.toLocaleDateString(undefined, { month: 'short' });
    };

    const getDayOfMonthLabel = (dateKey: string): string => {
      return dateKey.slice(8, 10);
    };

    const getFullDateLabel = (dateKey: string): string => {
      const date = parseLocalDateKey(dateKey);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const taskRecords = await this.executeQuery<RawTaskStatsRecord>(`
      SELECT id, priority, status, progress, created_at, updated_at, deleted_at, is_paused, duration_type, daily_progress
      FROM tasks
    `);

    const today = resolveMonthDate(monthDate);
    const currentDate = new Date();
    const currentDateNormalized = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
    // CRITICAL: todayKey MUST always be the actual current date for weight calculation cutoffs
    // NOT the selected month's date. This ensures previous months calculate complete data.
    const todayKey = getLocalDateString(currentDateNormalized);
    const isCurrentMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

    const buildDayKeys = (startKey: string, endKey: string): string[] => {
      const keys: string[] = [];
      const cursor = parseLocalDateKey(startKey);
      const end = parseLocalDateKey(endKey);

      while (cursor.getTime() <= end.getTime()) {
        keys.push(getLocalDateString(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      return keys;
    };

    const getTaskLifecycleEndKey = (task: RawTaskStatsRecord): string => {
      if (!task.deleted_at) return todayKey;
      const deletedDay = toLocalDayKey(task.deleted_at);
      return deletedDay < todayKey ? deletedDay : todayKey;
    };

    const makeEntry = (
      task: RawTaskStatsRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): { progress: number; status: DailyTaskState['status'] } => {
      const historyEntry = normalizedHistory[dayKey];
      if (historyEntry) {
        return { progress: historyEntry.progress ?? 0, status: historyEntry.status ?? 'pending' };
      }

      if (dayKey === todayKey) {
        return {
          progress: task.progress ?? 0,
          status: task.status ?? 'pending',
        };
      }

      return inferTaskStateForDay(task, dayKey, normalizedHistory, todayKey, getTaskLifecycleEndKey);
    };

    const isPausedOnDay = (
      task: RawTaskStatsRecord,
      dayKey: string,
      normalizedHistory: Record<string, DailyTaskState>
    ): boolean => {
      const historyEntry = normalizedHistory[dayKey];
      if (historyEntry) {
        return historyEntry.source === 'paused';
      }

      const rawIsPaused = task.is_paused;
      const isPausedNow = rawIsPaused === 1 || rawIsPaused === true;
      return dayKey === todayKey && isPausedNow;
    };

    const computePeriodWeights = (
      records: RawTaskStatsRecord[],
      startKey: string,
      endKey: string,
      fallbackDayKey?: string
    ) => {
      let plannedWeight = 0;
      let earnedWeight = 0;

      records.forEach((task) => {
        // NOTE: Do NOT skip paused tasks here - paused status may vary by day.
        // The isPausedOnDay check below will properly exclude them for specific days.
        
        const createdDay = toLocalDayKey(task.created_at);
        const lifecycleEndKey = getTaskLifecycleEndKey(task);
        if (createdDay > lifecycleEndKey) {
          return;
        }
        const normalizedHistory = normalizeDailyProgressFromDb(task.daily_progress, {
          ...task,
          created_at: task.created_at,
          updated_at: task.updated_at,
          status: task.status,
        } as Partial<Task>);

        const historyKeysInRange = Object.keys(normalizedHistory)
          .filter((key) => inRange(key, startKey, endKey) && key <= lifecycleEndKey)
          .sort();

        const occurrenceKeys = new Set<string>();
        if ((task.duration_type || 'today') === 'continuous') {
          const effectiveStartKey = createdDay > startKey ? createdDay : startKey;
          const effectiveEndKey = [endKey, todayKey, lifecycleEndKey].sort()[0];

          if (effectiveStartKey <= effectiveEndKey) {
            buildDayKeys(effectiveStartKey, effectiveEndKey).forEach((dayKey) => occurrenceKeys.add(dayKey));
          }
        } else if (inRange(createdDay, startKey, endKey) && createdDay <= lifecycleEndKey) {
          occurrenceKeys.add(createdDay);
        }

        historyKeysInRange.forEach((dayKey) => occurrenceKeys.add(dayKey));

        if (occurrenceKeys.size === 0) {
          return;
        }

        Array.from(occurrenceKeys).forEach((dayKey) => {
          if (fallbackDayKey && dayKey !== fallbackDayKey) {
            return;
          }

          if (isPausedOnDay(task, dayKey, normalizedHistory)) {
            return;
          }

          const entry = makeEntry(task, dayKey, normalizedHistory);
          const weight = priorityWeight(task.priority);

          plannedWeight += weight;
          earnedWeight += weight * completionFactor(entry.progress);
        });
      });

      const weightedProgress = plannedWeight > 0
        ? Math.round((earnedWeight / plannedWeight) * 100)
        : 0;

      return {
        plannedWeight,
        earnedWeight,
        weightedProgress,
      };
    };

    // Progress Trend: daily weighted completion rate with rolling average line
    const trendRates: number[] = [];
    const monthlyTrend: TaskMonthlyTrendPoint[] = [];
    
    // For current month: use today as end date
    // For historical months: use last day of that month
    const trendEndDate = isCurrentMonth 
      ? currentDate
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(trendEndDate);
      date.setDate(date.getDate() - i);
      const dateKey = getLocalDateString(date);
      const dayStats = computePeriodWeights(taskRecords, dateKey, dateKey, dateKey);
      const completionRate = dayStats.weightedProgress;

      trendRates.push(completionRate);
      const lookback = trendRates.slice(Math.max(0, trendRates.length - 7));
      const avgProgress = lookback.length > 0
        ? Math.round(lookback.reduce((sum, value) => sum + value, 0) / lookback.length)
        : 0;

      monthlyTrend.push({
        dateKey,
        day: getDayOfMonthLabel(dateKey),
        month: getMonthLabel(date),
        fullMonth: getFullDateLabel(dateKey),
        progress: avgProgress,
        completionRate,
        completed: dayStats.earnedWeight,
        total: dayStats.plannedWeight,
        target: 75,
      });
    }

    // Daily Activity: full month grid for selected month
    const selectedMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysInSelectedMonth = selectedMonthEnd.getDate();
    const currentDayKey = getLocalDateString(new Date());

    const dailyActivity: TaskDailyActivityPoint[] = [];
    for (let dayNumber = 1; dayNumber <= daysInSelectedMonth; dayNumber++) {
      const date = new Date(today.getFullYear(), today.getMonth(), dayNumber);
      const dateKey = getLocalDateString(date);
      const isFuture = dateKey > currentDayKey;
      const dayStats = isFuture
        ? { plannedWeight: 0, earnedWeight: 0, weightedProgress: 0 }
        : computePeriodWeights(taskRecords, dateKey, dateKey, dateKey);

      dailyActivity.push({
        dateKey,
        date: getDayOfMonthLabel(dateKey),
        day: getDayFromDateKey(dateKey),
        completed: dayStats.earnedWeight,
        updates: dayStats.plannedWeight,
        progress: dayStats.weightedProgress,
      });
    }

    // Consistency Heatmap: full current year (GitHub-style weeks x days)
    const heatmapYear = today.getFullYear();
    const yearStart = new Date(heatmapYear, 0, 1);
    const yearEnd = new Date(heatmapYear, 11, 31);
    const heatmapStart = new Date(yearStart);
    heatmapStart.setDate(heatmapStart.getDate() - heatmapStart.getDay()); // align to Sunday
    const heatmapEnd = new Date(yearEnd);
    heatmapEnd.setDate(heatmapEnd.getDate() + (6 - heatmapEnd.getDay())); // align to Saturday

    const heatmap: number[][] = [];
    for (let cursor = new Date(heatmapStart); cursor <= heatmapEnd; cursor.setDate(cursor.getDate() + 7)) {
      const weekData: number[] = [];

      for (let day = 0; day < 7; day++) {
        const targetDate = new Date(cursor);
        targetDate.setDate(targetDate.getDate() + day);
        const targetKey = getLocalDateString(targetDate);

        const isOutsideYear = targetDate < yearStart || targetDate > yearEnd;
        const isFuture = targetKey > todayKey;
        if (isOutsideYear || isFuture) {
          weekData.push(0);
          continue;
        }

        const dayStats = computePeriodWeights(taskRecords, targetKey, targetKey, targetKey);
        const pct = dayStats.weightedProgress;
        const intensity = pct <= 0
          ? 0
          : pct <= 20
            ? 1
            : pct <= 40
              ? 2
              : pct <= 60
                ? 3
                : pct <= 80
                  ? 4
                  : 5;

        weekData.push(intensity);
      }

      heatmap.push(weekData);
    }

    return {
      monthlyTrend,
      dailyActivity,
      heatmap,
      heatmapYear,
      heatmapStartDate: getLocalDateString(heatmapStart),
    };
  }

  async getTaskMonthlyHistory(): Promise<TaskMonthlyHistoryPoint[]> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [bounds] = await this.executeQuery<{ earliest_created_at: string | null }>(`
      SELECT MIN(created_at) as earliest_created_at
      FROM tasks
    `);

    if (!bounds?.earliest_created_at) {
      return [];
    }

    const earliestCreatedAt = new Date(bounds.earliest_created_at);
    if (Number.isNaN(earliestCreatedAt.getTime())) {
      return [];
    }

    const earliestMonthStart = new Date(earliestCreatedAt.getFullYear(), earliestCreatedAt.getMonth(), 1);
    if (earliestMonthStart >= currentMonthStart) {
      return [];
    }

    const history: TaskMonthlyHistoryPoint[] = [];
    const cursor = new Date(earliestMonthStart);

    while (cursor < currentMonthStart) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = endOfMonth(monthStart);
      const monthStartKey = getLocalDateString(monthStart);
      const monthEndKey = getLocalDateString(monthEnd);

      const snapshot = await this.getTaskRangeAnalyticsSnapshot(monthStartKey, monthEndKey);
      const summary = snapshot.summary;
      const consistency = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

      history.push({
        monthKey: monthStartKey.slice(0, 7),
        monthLabel: monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        total: summary.total,
        completed: summary.completed,
        plannedWeight: summary.plannedWeight,
        earnedWeight: summary.earnedWeight,
        completionRate: summary.weightedProgress,
        consistency,
      });

      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    }

    return history.reverse();
  }

  async getStats(): Promise<{
    totalGoals: number;
    totalTasks: number;
    totalHabits: number;
    totalNotes: number;
    completedTasks: number;
    activeHabits: number;
  }> {
    const queries = [
      { query: 'SELECT COUNT(*) as count FROM goals WHERE deleted_at IS NULL', key: 'totalGoals' },
      { query: 'SELECT COUNT(*) as count FROM tasks WHERE deleted_at IS NULL', key: 'totalTasks' },
      { query: 'SELECT COUNT(*) as count FROM habits WHERE deleted_at IS NULL', key: 'totalHabits' },
      { query: 'SELECT COUNT(*) as count FROM notes WHERE deleted_at IS NULL', key: 'totalNotes' },
      { query: 'SELECT COUNT(*) as count FROM tasks WHERE status = "completed" AND deleted_at IS NULL', key: 'completedTasks' },
      { query: 'SELECT COUNT(*) as count FROM habits WHERE streak_current > 0 AND deleted_at IS NULL', key: 'activeHabits' },
    ];
    
    const results = await Promise.all(
      queries.map(q => this.executeQuery<{count: number}>(q.query))
    );
    
    return {
      totalGoals: results[0][0]?.count || 0,
      totalTasks: results[1][0]?.count || 0,
      totalHabits: results[2][0]?.count || 0,
      totalNotes: results[3][0]?.count || 0,
      completedTasks: results[4][0]?.count || 0,
      activeHabits: results[5][0]?.count || 0,
    };
  }

  async getRecentActivity(limit = 10): Promise<AuditLog[]> {
    return this.executeQuery<AuditLog>(
      'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  // ============ REVIEW SYSTEM METHODS ============

  async getReviews(type?: string, limit: number = 50): Promise<Review[]> {
    if (!window.electronAPI) {
      return [];
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:getAll', type, limit);
      if (response?.success) {
        return (response.data || []).map((r: any) => this.parseReview(r));
      }
      throw new Error(response?.error || 'Failed to get reviews');
    } catch (error) {
      console.error('Failed to get reviews:', error);
      return [];
    }
  }

  async getReviewById(id: string): Promise<Review | null> {
    if (!window.electronAPI) {
      return null;
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:getById', id);
      if (response?.success && response.data) {
        return this.parseReview(response.data);
      }
      return null;
    } catch (error) {
      console.error('Failed to get review:', error);
      return null;
    }
  }

  async getLatestReview(type: string): Promise<Review | null> {
    if (!window.electronAPI) {
      return null;
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:getLatest', type);
      if (response?.success && response.data) {
        return this.parseReview(response.data);
      }
      return null;
    } catch (error) {
      console.error('Failed to get latest review:', error);
      return null;
    }
  }

  async getReviewForPeriod(type: string, periodStart: string, periodEnd: string): Promise<Review | null> {
    if (!window.electronAPI) {
      return null;
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:getForPeriod', type, periodStart, periodEnd);
      if (response?.success && response.data) {
        return this.parseReview(response.data);
      }
      return null;
    } catch (error) {
      console.error('Failed to get review for period:', error);
      return null;
    }
  }

  async createReview(data: CreateReviewDTO): Promise<Review | null> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:create', data);
      if (response?.success && response.data) {
        return this.parseReview(response.data);
      }
      throw new Error(response?.error || 'Failed to create review');
    } catch (error) {
      console.error('Failed to create review:', error);
      throw error;
    }
  }

  async updateReview(id: string, data: UpdateReviewDTO): Promise<Review | null> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:update', id, data);
      if (response?.success && response.data) {
        return this.parseReview(response.data);
      }
      throw new Error(response?.error || 'Failed to update review');
    } catch (error) {
      console.error('Failed to update review:', error);
      throw error;
    }
  }

  async deleteReview(id: string): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:delete', id);
      return response?.success || false;
    } catch (error) {
      console.error('Failed to delete review:', error);
      return false;
    }
  }

  async getReviewInsights(periodStart: string, periodEnd: string): Promise<ReviewInsights | null> {
    if (!window.electronAPI) {
      return null;
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:getInsights', periodStart, periodEnd);
      if (response?.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get review insights:', error);
      return null;
    }
  }

  async getReviewHistory(type?: string, startDate?: string, endDate?: string): Promise<Review[]> {
    if (!window.electronAPI) {
      return [];
    }
    
    try {
      const response = await window.electronAPI.invoke('reviews:getHistory', type, startDate, endDate);
      if (response?.success) {
        return (response.data || []).map((r: any) => this.parseReview(r));
      }
      return [];
    } catch (error) {
      console.error('Failed to get review history:', error);
      return [];
    }
  }

  private parseReview(data: any): Review {
    return {
      ...data,
      responses: typeof data.responses === 'string' ? JSON.parse(data.responses) : (data.responses || {}),
      insights: typeof data.insights === 'string' ? JSON.parse(data.insights) : (data.insights || {}),
      action_items: typeof data.action_items === 'string' ? JSON.parse(data.action_items) : (data.action_items || []),
      tags: typeof data.tags === 'string' ? JSON.parse(data.tags) : (data.tags || []),
    };
  }
}

// Review types for the database service
export interface Review {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  status: 'draft' | 'completed';
  period_start: string;
  period_end: string;
  responses: any;
  insights: any;
  action_items: ReviewActionItem[];
  tags: string[];
  mood?: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  version: number;
}

export interface ReviewActionItem {
  id: string;
  type: 'task' | 'habit' | 'goal' | 'adjustment';
  description: string;
  completed: boolean;
  created_from_review: string;
  linked_entity_id?: string;
  due_date?: string;
}

export interface ReviewInsights {
  tasksCompleted: number;
  tasksCreated: number;
  taskCompletionRate: number;
  taskEligibleCount?: number;
  overdueTasksCount: number;
  blockedTasksCount: number;
  avgTaskCompletionTime: number;
  topCompletedTasks: Array<{ id: string; title: string; completedAt: string }>;
  skippedOrAbandonedTasks: Array<{ id: string; title: string; reason: string }>;
  habitConsistencyRate: number;
  habitsCompleted: number;
  habitsMissed: number;
  habitPeriodsCompleted?: number;
  habitPeriodsExpected?: number;
  currentStreaks: Array<{ id: string; title: string; streak: number }>;
  brokenStreaks: Array<{ id: string; title: string; previousStreak: number }>;
  habitTrend: 'improving' | 'stable' | 'declining';
  activeGoalsProgress: Array<{ id: string; title: string; progress: number; change: number }>;
  goalsCompletedThisPeriod: number;
  goalsAtRisk: Array<{ id: string; title: string; progress: number; reason: string }>;
  mostProductiveDay?: string;
  leastProductiveDay?: string;
  productivityTrend: 'improving' | 'stable' | 'declining';
  consistencyScore: number;
  combinedCompletionRate?: number;
  periodStart: string;
  periodEnd: string;
}

export interface CreateReviewDTO {
  type: 'daily' | 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  responses?: any;
  insights?: any;
  action_items?: ReviewActionItem[];
  tags?: string[];
  mood?: string;
  status?: 'draft' | 'completed';
}

export interface UpdateReviewDTO {
  responses?: any;
  insights?: any;
  action_items?: ReviewActionItem[];
  tags?: string[];
  mood?: string;
  status?: 'draft' | 'completed';
}

// Singleton instance
export const database = DatabaseService.getInstance();

// React hooks for database operations
export const useDatabase = () => {
  return database;
};

// Utility function to parse JSON fields
export function parseJSONField<T>(field: string | null | undefined, defaultValue: T): T {
  if (!field) return defaultValue;
  try {
    return JSON.parse(field);
  } catch {
    return defaultValue;
  }
}

// Utility function to serialize JSON fields
export function serializeJSONField(data: any): string {
  return JSON.stringify(data || []);
}

// Type guards
export function isGoal(obj: any): obj is Goal {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string' && 'category' in obj;
}

export function isTask(obj: any): obj is Task {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string' && 'status' in obj;
}

export function isHabit(obj: any): obj is Habit {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string' && 'frequency' in obj;
}

export function isNote(obj: any): obj is Note {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string' && 'type' in obj;
}