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

export interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'blocked' | 'completed';
  progress: number;
  daily_progress?: Record<string, number>;
  estimated_time: number | null;
  actual_time: number | null;
  recurrence_rule: string | null;
  project_id: string | null;
  goal_id: string | null;
  parent_task_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  version: number;
  goal_title?: string; // Joined from goals table
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
  type: 'free' | 'daily' | 'weekly' | 'goal' | 'task';
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
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  due_date?: string;
  priority: Task['priority'];
  estimated_time?: number;
  goal_id?: string;
  tags?: string[];
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {
  status?: Task['status'];
  progress?: number;
  actual_time?: number;
  daily_progress?: Record<string, number>;
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
  type: Note['type'];
  mood?: string;
  goal_id?: string;
  task_id?: string;
  tags?: string[];
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
    
    const results = await this.executeQuery<Goal>(query, params);
    return results.map(goal => ({
      ...goal,
      tags: JSON.parse(goal.tags || '[]'),
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
      tags: JSON.parse(goal.tags || '[]'),
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
    return results.map(task => ({
      ...task,
      tags: JSON.parse(task.tags || '[]'),
      daily_progress: JSON.parse((task as any).daily_progress || '{}'),
    }));
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
    return {
      ...task,
      tags: JSON.parse(task.tags || '[]'),
      daily_progress: JSON.parse((task as any).daily_progress || '{}'),
    };
  }

  async createTask(data: CreateTaskDTO): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        INSERT INTO tasks (
          id, title, description, due_date, priority, status, progress,
          estimated_time, actual_time, goal_id, tags, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, NULL, ?, ?, ?, ?, 1)
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
    if (data.daily_progress !== undefined) {
      updates.push('daily_progress = ?');
      params.push(JSON.stringify(data.daily_progress || {}));
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
      schedule: JSON.parse(habit.schedule || '[]'),
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
      schedule: JSON.parse(habit.schedule || '[]'),
    };
  }

  async getTodaysHabits(): Promise<Habit[]> {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayOfMonth = new Date().getDate().toString();
    
    const results = await this.executeQuery<Habit & { today_completed: number }>(
      `SELECT h.*, g.title as goal_title,
              COALESCE(hc.completed, 0) as today_completed
       FROM habits h
       LEFT JOIN goals g ON h.goal_id = g.id
       LEFT JOIN habit_completions hc ON h.id = hc.habit_id AND hc.date = ?
       WHERE h.deleted_at IS NULL
       AND (
         h.frequency = 'daily' OR
         (h.frequency = 'weekly' AND ? IN (SELECT value FROM json_each(h.schedule))) OR
         (h.frequency = 'monthly' AND ? IN (SELECT value FROM json_each(h.schedule)))
       )
       ORDER BY h.streak_current DESC`,
      [today, dayOfWeek, dayOfMonth]
    );
    
    return results.map(habit => ({
      ...habit,
      schedule: JSON.parse(habit.schedule || '[]'),
      today_completed: habit.today_completed === 1,
    }));
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
    const today = new Date().toISOString().split('T')[0];
    const dateStr = typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().split('T')[0];

    // INTEGRITY CHECK: Prevent future date completions (no gaming by pre-completing)
    if (dateStr > today) {
      console.warn(`[INTEGRITY] Attempted to set habit completion for future date: ${dateStr}`);
      return; // Silently ignore future completions
    }

    if (completed) {
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

    const completionRows = await this.executeQuery<{ date: string }>(`
      SELECT date FROM habit_completions 
      WHERE habit_id = ? AND completed = 1
      ORDER BY date DESC
    `, [habitId]);

    const completedDates = new Set(
      (Array.isArray(completionRows) ? completionRows : []).map((row) => row.date?.slice(0, 10))
    );

    const toDateKey = (d: Date) => d.toISOString().split('T')[0];
    let currentStreak = 0;
    let cursor = new Date();

    if (completedDates.has(toDateKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      cursor.setDate(cursor.getDate() - 1);
      if (completedDates.has(toDateKey(cursor))) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    if (currentStreak > 0) {
      while (completedDates.has(toDateKey(cursor))) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const consistencyResult = await this.executeQuery<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM habit_completions 
      WHERE habit_id = ? 
      AND completed = 1 
      AND date >= date('now', '-30 days')
    `, [habitId]);

    const consistencyCount = consistencyResult?.[0]?.count || 0;
    const consistencyScore = Math.min(100, Math.round((consistencyCount / 30) * 100));

    await this.executeQuery(`
      UPDATE habits 
      SET streak_current = ?,
          streak_longest = MAX(?, streak_longest),
          consistency_score = ?,
          updated_at = ?,
          version = version + 1
      WHERE id = ?
    `, [currentStreak, currentStreak, consistencyScore, now, habitId]);
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
    const now = new Date().toISOString();
    await this.executeTransaction([{
      query: `
        UPDATE tasks 
        SET deleted_at = NULL, updated_at = ?, version = version + 1
        WHERE id = ?
      `,
      params: [now, id]
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
  async permanentlyDeleteTask(id: string): Promise<void> {
    await this.executeTransaction([{
      query: `DELETE FROM tasks WHERE id = ?`,
      params: [id]
    }]);
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

  // Get archived items for the archive page
  async getArchivedItems(): Promise<{
    tasks: Task[];
    habits: Habit[];
    goals: Goal[];
    notes: Note[];
  }> {
    const [tasks, habits, goals, notes] = await Promise.all([
      this.executeQuery<Task>(`
        SELECT t.*, g.title as goal_title 
        FROM tasks t
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE t.deleted_at IS NOT NULL
        ORDER BY t.deleted_at DESC
      `),
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
      `)
    ]);

    return {
      tasks: tasks.map(task => ({
        ...task,
        tags: JSON.parse(task.tags || '[]'),
        daily_progress: JSON.parse((task as any).daily_progress || '{}'),
      })),
      habits: habits.map(habit => ({
        ...habit,
        schedule: JSON.parse(habit.schedule || '[]'),
      })),
      goals: goals.map(goal => ({
        ...goal,
        tags: JSON.parse(goal.tags || '[]'),
      })),
      notes: notes.map(note => ({
        ...note,
        tags: JSON.parse(note.tags || '[]'),
      })),
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
        (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NOT NULL) as tasks,
        (SELECT COUNT(*) FROM habits WHERE deleted_at IS NOT NULL) as habits,
        (SELECT COUNT(*) FROM goals WHERE deleted_at IS NOT NULL) as goals,
        (SELECT COUNT(*) FROM notes WHERE deleted_at IS NOT NULL) as notes
    `);

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
    return results.map(note => ({
      ...note,
      tags: JSON.parse(note.tags || '[]'),
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
    
    const note = results[0];
    return {
      ...note,
      tags: JSON.parse(note.tags || '[]'),
    };
  }

  async createNote(data: CreateNoteDTO): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.executeTransaction([{
      query: `
        INSERT INTO notes (
          id, title, content, type, mood, goal_id, task_id, tags,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
            goal_id = ?, task_id = ?, tags = ?, updated_at = ?, version = version + 1
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
        `,
        params: [startOfDay, endOfDay]
      },
      // Overdue tasks
      {
        query: `
          SELECT COUNT(*) as overdue_tasks
          FROM tasks 
          WHERE due_date < ?
          AND status NOT IN ('completed', 'archived')
          AND deleted_at IS NULL
        `,
        params: [new Date().toISOString()]
      }
    ];
    
    const results = await Promise.all(
      queries.map(q => this.executeQuery<any>(q.query, q.params))
    );
    
    return {
      today_tasks: results[0][0]?.today_tasks || 0,
      active_goals: results[1][0]?.active_goals || 0,
      avg_progress: results[1][0]?.avg_progress || 0,
      completed_habits: results[2][0]?.completed_habits || 0,
      focus_time_today: results[3][0]?.focus_time_today || 0,
      overdue_tasks: results[4][0]?.overdue_tasks || 0,
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
  overdueTasksCount: number;
  blockedTasksCount: number;
  avgTaskCompletionTime: number;
  topCompletedTasks: Array<{ id: string; title: string; completedAt: string }>;
  skippedOrAbandonedTasks: Array<{ id: string; title: string; reason: string }>;
  habitConsistencyRate: number;
  habitsCompleted: number;
  habitsMissed: number;
  currentStreaks: Array<{ id: string; title: string; streak: number }>;
  brokenStreaks: Array<{ id: string; title: string; previousStreak: number }>;
  habitTrend: 'improving' | 'stable' | 'declining';
  activeGoalsProgress: Array<{ id: string; title: string; progress: number; change: number }>;
  goalsCompletedThisPeriod: number;
  goalsAtRisk: Array<{ id: string; title: string; reason: string }>;
  mostProductiveDay?: string;
  leastProductiveDay?: string;
  productivityTrend: 'improving' | 'stable' | 'declining';
  consistencyScore: number;
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