use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial_schema",
            kind: MigrationKind::Up,
            sql: "
          CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT CHECK(category IN ('career', 'health', 'learning', 'finance', 'personal', 'custom')) NOT NULL,
            priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) NOT NULL,
            status TEXT CHECK(status IN ('active', 'paused', 'completed', 'archived')) NOT NULL DEFAULT 'active',
            start_date TEXT NOT NULL,
            target_date TEXT,
            motivation TEXT,
            review_frequency TEXT CHECK(review_frequency IN ('daily', 'weekly', 'monthly', 'quarterly')) NOT NULL DEFAULT 'weekly',
            progress_method TEXT CHECK(progress_method IN ('manual', 'task-based', 'milestone-based')) NOT NULL DEFAULT 'manual',
            progress REAL CHECK(progress >= 0 AND progress <= 100) NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            version INTEGER NOT NULL DEFAULT 1
          );
          
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            goal_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT CHECK(status IN ('planning', 'active', 'completed', 'cancelled')) NOT NULL DEFAULT 'planning',
            start_date TEXT NOT NULL,
            end_date TEXT,
            progress REAL CHECK(progress >= 0 AND progress <= 100) NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
          );
          
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            due_date TEXT,
            priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) NOT NULL DEFAULT 'medium',
            status TEXT CHECK(status IN ('pending', 'in-progress', 'blocked', 'completed')) NOT NULL DEFAULT 'pending',
            progress REAL CHECK(progress >= 0 AND progress <= 100) NOT NULL DEFAULT 0,
            estimated_time INTEGER,
            actual_time INTEGER,
            recurrence_rule TEXT,
            project_id TEXT,
            goal_id TEXT,
            parent_task_id TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            deleted_at TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
            FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
          );
          
          CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
          CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
          CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
          CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
          CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
          CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
          CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
          CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
          CREATE INDEX IF NOT EXISTS idx_goals_deleted_at ON goals(deleted_at);
          CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
            "
        },
        Migration {
            version: 2,
            description: "add_checklists_habits_notes_timeblocks",
            kind: MigrationKind::Up,
            sql: "
          CREATE TABLE IF NOT EXISTS checklist_items (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            title TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            weight REAL NOT NULL DEFAULT 1.0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
          );
          
          CREATE TABLE IF NOT EXISTS habits (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'monthly')) NOT NULL,
            schedule TEXT NOT NULL DEFAULT '[]',
            goal_id TEXT,
            streak_current INTEGER NOT NULL DEFAULT 0,
            streak_longest INTEGER NOT NULL DEFAULT 0,
            consistency_score REAL CHECK(consistency_score >= 0 AND consistency_score <= 100) NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
          );
          
          CREATE TABLE IF NOT EXISTS habit_completions (
            id TEXT PRIMARY KEY,
            habit_id TEXT NOT NULL,
            date TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
            UNIQUE(habit_id, date)
          );
          
          CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT CHECK(type IN ('free', 'daily', 'weekly', 'goal', 'task')) NOT NULL,
            mood TEXT,
            goal_id TEXT,
            task_id TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            pinned INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
          );
          
          CREATE TABLE IF NOT EXISTS time_blocks (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            habit_id TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            duration INTEGER NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
            FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
          );
          
          CREATE INDEX IF NOT EXISTS idx_habits_frequency ON habits(frequency);
          CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date);
          CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
          CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks(start_time);
          CREATE INDEX IF NOT EXISTS idx_habits_deleted_at ON habits(deleted_at);
          CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
            "
        },
        Migration {
            version: 3,
            description: "add_audit_backups_sync",
            kind: MigrationKind::Up,
            sql: "
          CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT CHECK(action IN ('create', 'update', 'delete', 'restore')) NOT NULL,
            old_value TEXT,
            new_value TEXT,
            user_id TEXT NOT NULL DEFAULT 'system',
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT
          );
          
          CREATE TABLE IF NOT EXISTS backups (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            size INTEGER NOT NULL,
            checksum TEXT NOT NULL,
            version INTEGER NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS sync_state (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            last_synced TEXT NOT NULL,
            sync_version INTEGER NOT NULL,
            pending BOOLEAN NOT NULL DEFAULT FALSE,
            UNIQUE(entity_type, entity_id)
          );
          
          CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
          CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
          CREATE INDEX IF NOT EXISTS idx_backups_timestamp ON backups(timestamp);
          CREATE INDEX IF NOT EXISTS idx_sync_state_pending ON sync_state(pending);
            "
        },
        Migration {
            version: 4,
            description: "add_views_and_triggers",
            kind: MigrationKind::Up,
            sql: "
          CREATE VIEW IF NOT EXISTS v_active_goals AS
          SELECT 
            g.*,
            COUNT(DISTINCT t.id) as task_count,
            COUNT(DISTINCT CASE WHEN (t.status = 'completed' OR t.progress IN (25, 50, 75, 100)) THEN t.id END) as completed_tasks,
            COUNT(DISTINCT p.id) as project_count
          FROM goals g
          LEFT JOIN projects p ON g.id = p.goal_id AND p.deleted_at IS NULL
          LEFT JOIN tasks t ON g.id = t.goal_id AND t.deleted_at IS NULL
          WHERE g.status = 'active' 
            AND g.deleted_at IS NULL
          GROUP BY g.id;
          
          CREATE VIEW IF NOT EXISTS v_today_tasks AS
          SELECT t.*,
            g.title as goal_title,
            p.title as project_title
          FROM tasks t
          LEFT JOIN goals g ON t.goal_id = g.id
          LEFT JOIN projects p ON t.project_id = p.id
          WHERE NOT (t.status = 'completed' OR t.progress IN (25, 50, 75, 100))
            AND t.due_date IS NOT NULL
            AND date(t.due_date) <= date('now')
            AND t.deleted_at IS NULL
          ORDER BY 
            CASE t.priority 
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            t.due_date;
          
          CREATE TRIGGER IF NOT EXISTS update_task_progress_from_checklist
          AFTER UPDATE OF completed ON checklist_items
          BEGIN
            UPDATE tasks
            SET progress = (
              SELECT 
                COALESCE(SUM(CASE WHEN completed = 1 THEN weight ELSE 0 END) * 100.0 / NULLIF(SUM(weight), 0), 0)
              FROM checklist_items
              WHERE task_id = NEW.task_id
                AND deleted_at IS NULL
            ),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.task_id;
          END;
          
          CREATE TRIGGER IF NOT EXISTS audit_goal_update
          AFTER UPDATE ON goals
          WHEN OLD.status != NEW.status OR OLD.progress != NEW.progress
          BEGIN
            INSERT INTO audit_log (id, entity_type, entity_id, action, old_value, new_value)
            VALUES (
              hex(randomblob(16)),
              'goal',
              NEW.id,
              'update',
              json_object('status', OLD.status, 'progress', OLD.progress, 'title', OLD.title),
              json_object('status', NEW.status, 'progress', NEW.progress, 'title', NEW.title)
            );
          END;
          
          CREATE TRIGGER IF NOT EXISTS audit_task_completion
          AFTER UPDATE OF status ON tasks
          WHEN OLD.status != 'completed' AND NEW.status = 'completed'
          BEGIN
            INSERT INTO audit_log (id, entity_type, entity_id, action, old_value, new_value)
            VALUES (
              hex(randomblob(16)),
              'task',
              NEW.id,
              'update',
              json_object('status', OLD.status, 'title', OLD.title),
              json_object('status', NEW.status, 'title', NEW.title, 'completed_at', NEW.completed_at)
            );
          END;
            "
        },
        Migration {
            version: 7,
            description: "add_reviews",
            kind: MigrationKind::Up,
            sql: "
          CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            type TEXT CHECK(type IN ('daily', 'weekly', 'monthly')) NOT NULL,
            status TEXT CHECK(status IN ('draft', 'completed')) NOT NULL DEFAULT 'draft',
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            responses TEXT NOT NULL DEFAULT '{}',
            insights TEXT NOT NULL DEFAULT '{}',
            action_items TEXT NOT NULL DEFAULT '[]',
            tags TEXT NOT NULL DEFAULT '[]',
            mood TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            deleted_at TEXT,
            version INTEGER NOT NULL DEFAULT 1
          );
          
          CREATE INDEX IF NOT EXISTS idx_reviews_type ON reviews(type);
          CREATE INDEX IF NOT EXISTS idx_reviews_period ON reviews(period_start, period_end);
          CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
          CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
            "
        },
        Migration {
            version: 13,
            description: "update_task_schema_with_all_new_columns",
            kind: MigrationKind::Up,
            sql: "
            -- Because Tauri SQLite migrations are applied in sequence on fresh DBs,
            -- we can just recreate the table if we need to modify a constraint.
            -- But since this is a new setup, we can just ALTER TABLE for columns added later.
            ALTER TABLE tasks ADD COLUMN daily_progress TEXT NOT NULL DEFAULT '{}';
            ALTER TABLE tasks ADD COLUMN duration_type TEXT NOT NULL DEFAULT 'today';
            ALTER TABLE tasks ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE tasks ADD COLUMN paused_at TEXT;
            ALTER TABLE tasks ADD COLUMN last_reset_date TEXT;
            ALTER TABLE goals ADD COLUMN completed_at TEXT;
            "
        }
    ]
}
