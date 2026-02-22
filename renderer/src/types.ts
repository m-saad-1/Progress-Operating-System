// Shared type definitions

// 3-tier priority system with weights: HIGH=3, MEDIUM=2, LOW=1
export type Priority = 'low' | 'medium' | 'high';

// Task status: 'skipped' replaces 'not started' in UI
export type TaskStatus = 'pending' | 'in-progress' | 'skipped' | 'blocked' | 'completed';

// Task duration type: today-only or continuous/multi-day
export type TaskDurationType = 'today' | 'continuous';

// Progressive completion levels (0, 25, 50, 75, 100)
export type TaskProgress = 0 | 25 | 50 | 75 | 100;

export interface DailyTaskState {
  progress: TaskProgress;
  status: TaskStatus;
  recorded_at: string; // ISO timestamp when entry was stored
  source: 'user' | 'rollover' | 'reset' | 'restore' | 'paused';
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  progress: TaskProgress; // Progressive completion (0-100 in 25% increments)
  duration_type: TaskDurationType; // 'today' = today only, 'continuous' = multi-day
  // Daily ledger keyed by YYYY-MM-DD capturing status + progress
  daily_progress?: Record<string, DailyTaskState>;
  is_paused?: boolean; // Whether continuous task is paused
  paused_at?: string; // When the task was paused
  last_reset_date?: string; // YYYY-MM-DD when task last reset for continuous flows
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

export interface HabitCompletion {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}