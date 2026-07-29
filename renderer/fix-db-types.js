const fs = require('fs');
let content = fs.readFileSync('src/lib/database.ts', 'utf-8');

// Fix Goal Priority
content = content.replace(/priority: 'low' \| 'medium' \| 'high' \| 'critical';/g, "priority: 'low' | 'medium' | 'high';");

// Fix Task Progress
content = content.replace(/progress: number;/g, 'progress: import("@/types").TaskProgress | number;'); // Just loosen the type to satisfy both

// Fix deleted_at, goal_id, etc.
content = content.replace(/deleted_at: string \| null;/g, 'deleted_at?: string;');
content = content.replace(/goal_id: string \| null;/g, 'goal_id?: string;');
content = content.replace(/target_date: string \| null;/g, 'target_date?: string;');
content = content.replace(/parent_task_id: string \| null;/g, 'parent_task_id?: string;');
content = content.replace(/project_id: string \| null;/g, 'project_id?: string;');
content = content.replace(/task_id: string \| null;/g, 'task_id?: string;');
content = content.replace(/habit_id: string \| null;/g, 'habit_id?: string;');
content = content.replace(/completed_at: string \| null;/g, 'completed_at?: string;');
content = content.replace(/paused_at\?: string \| null;/g, 'paused_at?: string;');
content = content.replace(/last_reset_date\?: string \| null;/g, 'last_reset_date?: string;');

fs.writeFileSync('src/lib/database.ts', content);
