export type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'completed';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimated_time?: number;
  actual_time?: number;
  goal_id?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  deleted_at?: string;
  is_paused?: boolean;
  paused_at?: string;
}

export type GoalCategory = 'career' | 'health' | 'learning' | 'finance' | 'personal' | 'custom';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number;
  target_date?: string;
  start_date: string;
  completed_at?: string;
  motivation: string;
  review_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  progress_method: 'manual' | 'task-based' | 'milestone-based';
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export interface Habit {
  id: string;
  title: string;
  description: string;
  frequency: HabitFrequency;
  schedule: string[];
  consistency_score: number;
  streak_current: number;
  streak_longest: number;
  goal_id?: string;
  today_completed?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}