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
export interface Backup {
    id: string;
    path: string;
    timestamp: string;
    size: number;
    checksum: string;
    version: number;
}
export interface SyncState {
    id: string;
    entity_type: string;
    entity_id: string;
    last_synced: string;
    sync_version: number;
    pending: boolean;
}
export interface GoalWithStats extends Goal {
    task_count: number;
    completed_tasks: number;
    project_count: number;
}
export interface TaskWithRelations extends Task {
    goal_title: string | null;
    project_title: string | null;
}
export declare const GoalCategory: {
    readonly CAREER: "career";
    readonly HEALTH: "health";
    readonly LEARNING: "learning";
    readonly FINANCE: "finance";
    readonly PERSONAL: "personal";
    readonly CUSTOM: "custom";
};
export declare const GoalPriority: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
export declare const GoalStatus: {
    readonly ACTIVE: "active";
    readonly PAUSED: "paused";
    readonly COMPLETED: "completed";
    readonly ARCHIVED: "archived";
};
export declare const TaskStatus: {
    readonly PENDING: "pending";
    readonly IN_PROGRESS: "in-progress";
    readonly BLOCKED: "blocked";
    readonly COMPLETED: "completed";
};
export declare const HabitFrequency: {
    readonly DAILY: "daily";
    readonly WEEKLY: "weekly";
    readonly MONTHLY: "monthly";
};
export declare const NoteType: {
    readonly FREE: "free";
    readonly DAILY: "daily";
    readonly WEEKLY: "weekly";
    readonly GOAL: "goal";
    readonly TASK: "task";
};
export type EntityType = 'goal' | 'project' | 'task' | 'habit' | 'note' | 'time_block' | 'checklist_item';
export type AuditAction = 'create' | 'update' | 'delete' | 'restore';
//# sourceMappingURL=schema.d.ts.map