// Shared type definitions

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'completed';

// Progressive completion levels (0, 25, 50, 75, 100)
export type TaskProgress = 0 | 25 | 50 | 75 | 100;

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  progress: TaskProgress; // Progressive completion (0-100 in 25% increments)
  daily_progress?: Record<string, number>;
  due_date?: string;
  estimated_time?: number;
  actual_time?: number;
  goal_id?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  deleted_at?: string;
}

// Monthly Progress - Separate from task completion
export interface MonthlyProgress {
  id: string;
  year: number;
  month: number; // 1-12
  task_completion_score: number; // 0-100, auto-calculated from completed tasks
  self_assessment_score: number; // 0-100, manual input
  final_score: number; // 0-100, weighted average
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Task completion history for analytics
export interface TaskCompletionRecord {
  id: string;
  task_id: string;
  date: string;
  progress_from: TaskProgress;
  progress_to: TaskProgress;
  created_at: string;
}

export type GoalCategory = 'career' | 'health' | 'learning' | 'finance' | 'personal' | 'custom';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type ReviewFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ProgressMethod = 'manual' | 'task-based' | 'milestone-based';

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: Priority;
  status: GoalStatus;
  progress: number;
  start_date: string;
  target_date?: string;
  motivation?: string;
  review_frequency: ReviewFrequency;
  progress_method: ProgressMethod;
  tags?: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  deleted_at?: string;
}

export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  schedule: string[];
  goal_id?: string;
  streak_current: number;
  streak_longest: number;
  consistency_score: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}