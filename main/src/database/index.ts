import fs from 'fs-extra';
import crypto from 'crypto';
import { app } from 'electron';
import { promisify } from 'util';
import { 
  Goal, Project, Task, ChecklistItem, Habit, HabitCompletion, 
  Note, TimeBlock, AuditLog, Backup, SyncState 
} from './schema';

import Database from 'better-sqlite3';
import path from 'path';

export class ProgressDatabase {
  private db!: Database.Database;
  private encryptionKey: Buffer | null = null;
  private backupInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  
  constructor() {
    // Initialize in constructor
    this.initEncryption();
  }
  
  private initEncryption() {
    const keyPath = path.join(app.getPath('userData'), 'encryption.key');
    const keyDir = path.dirname(keyPath);
    
    // Ensure directory exists
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }
    
    if (fs.existsSync(keyPath)) {
      try {
        this.encryptionKey = fs.readFileSync(keyPath);
          } catch (error) {
            if (error instanceof Error) {
              console.error('Failed to read encryption key:', error.message);
            } else {
              console.error('Failed to read encryption key:', error);
            }
            this.generateNewKey(keyPath);
          }    } else {
      this.generateNewKey(keyPath);
    }
  }
  
  private generateNewKey(keyPath: string) {
    this.encryptionKey = crypto.randomBytes(32);
    try {
      fs.writeFileSync(keyPath, this.encryptionKey);
      fs.chmodSync(keyPath, 0o600); // Read/write only by owner
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to write encryption key:', error.message);
      } else {
        console.error('Failed to write encryption key:', error);
      }
      throw new Error('Unable to initialize encryption');
    }
  }
  
  async initialize(): Promise<void> {
    console.log('ProgressDatabase: initialize() started');
    if (this.isInitialized) return;
    
    const dbPath = path.join(app.getPath('userData'), 'progress.db');
    const dbDir = path.dirname(dbPath);
    
    console.log('ProgressDatabase: Ensuring database directory exists at', dbDir);
    await fs.ensureDir(dbDir);
    console.log('ProgressDatabase: Database directory ensured.');
    
    // Open database
    console.log('ProgressDatabase: Opening database at', dbPath);
    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });
    console.log('ProgressDatabase: Database opened.');
    
    // Enable WAL mode for better concurrency and crash recovery
    console.log('ProgressDatabase: Setting pragmas.');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('secure_delete = ON');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -2000'); // 2MB cache
    console.log('ProgressDatabase: Pragmas set.');
    
    // Run migrations
    await this.runMigrations();

    // IMPORTANT:
    // - Do NOT auto-seed demo data in production or after a user-initiated wipe.
    // - Do NOT run a second hidden backup system here.
    // Backups are handled by main/src/backup and restore must be explicit.
    const enableDemoData = process.env.PERSONALOS_ENABLE_DEMO_DATA === 'true';
    if (enableDemoData) {
      await this.initializeDemoData();
    }
    
    // Setup change tracking
    this.setupChangeTracking();
    
    this.isInitialized = true;
    
    console.log('Database initialized successfully');
  }
  
  private async runMigrations(): Promise<void> {
    console.log('ProgressDatabase: runMigrations() started');
    // Get current version
    let currentVersion = 0;
    console.log('ProgressDatabase: Getting current database version.');
    try {
      const versionResult = this.db.prepare(
        'PRAGMA user_version'
      ).get() as { user_version: number };
      currentVersion = versionResult.user_version;
      console.log('ProgressDatabase: Current database version:', currentVersion);
    } catch (error) {
      console.warn('Failed to get database version:', error);
    }
    
    // Migration scripts
    const migrations = [
      // Version 1: Initial schema
      {
        version: 1,
        up: `
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
        `,
      },
      
      // Version 2: Add checklist, habits, notes, and time blocks
      {
        version: 2,
        up: `
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
        `,
      },
      
      // Version 3: Add audit log, backups, and sync state
      {
        version: 3,
        up: `
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
        `,
      },
      
      // Version 4: Add views and triggers
      {
        version: 4,
        up: `
          -- View for active goals with progress
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
          
          -- View for today's tasks
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
          
          -- Trigger for updating task progress from checklist
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
          
          -- Trigger for audit logging on goal updates
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
          
          -- Trigger for audit logging on task completion
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
        `,
      },
      
      // Version 5: Add missing completed_at column to tasks if it doesn't exist
      {
        version: 5,
        up: `
          -- Add completed_at column if missing (for databases created before this was in the schema)
          -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we check via pragma
          -- This is safe because SQLite ignores duplicate column additions silently via transaction rollback
        `,
      },

      // Version 6: Add daily_progress column to tasks if it doesn't exist
      {
        version: 6,
        up: `
          -- Add daily_progress column if missing (for per-day task progress tracking)
          -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we check via pragma
        `,
      },

      // Version 7: Add reviews table for the Review System
      {
        version: 7,
        up: `
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
        `,
      },
      
      // Version 8: Add duration_type column to tasks and update status/priority constraints
      {
        version: 8,
        up: `
          -- Add duration_type column to tasks if missing
          -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, handled programmatically
        `,
      },
      
      // Version 9: Add completed_at column to goals table
      {
        version: 9,
        up: `
          -- Add completed_at column to goals if missing
          -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, handled programmatically
        `,
      },
      
      // Version 10: Add is_paused and paused_at columns to tasks for continuous task pause functionality
      {
        version: 10,
        up: `
          -- Add is_paused and paused_at columns to tasks if missing
          -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, handled programmatically
        `,
      },
      
      // Version 11: Add last_reset_date column to tasks for daily reset tracking
      {
        version: 11,
        up: `
          -- Add last_reset_date column to tasks if missing
          -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, handled programmatically
        `,
      },
      
      // Version 12: Add pinned column to notes for pinning functionality
      {
        version: 12,
        up: `
          -- Add pinned column to notes if missing
          -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, handled programmatically
        `,
      },
    ];
    
    // Run migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration to version ${migration.version}`);
        
        // Special handling for version 5 - check if completed_at column exists
        if (migration.version === 5) {
          try {
            const tableInfo = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{name: string}>;
            const hasCompletedAt = tableInfo.some(col => col.name === 'completed_at');
            
            if (!hasCompletedAt) {
              console.log('Adding missing completed_at column to tasks table');
              this.db.exec('ALTER TABLE tasks ADD COLUMN completed_at TEXT');
            }
            
            // Update version
            this.db.exec(`PRAGMA user_version = ${migration.version}`);
            console.log(`Migration to version ${migration.version} completed successfully`);
            continue;
          } catch (error) {
            console.error('Failed to check/add completed_at column:', error);
            throw error;
          }
        }

        // Special handling for version 6 - check if daily_progress column exists
        if (migration.version === 6) {
          try {
            const tableInfo = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{name: string}>;
            const hasDailyProgress = tableInfo.some(col => col.name === 'daily_progress');

            if (!hasDailyProgress) {
              console.log('Adding daily_progress column to tasks table');
              this.db.exec("ALTER TABLE tasks ADD COLUMN daily_progress TEXT NOT NULL DEFAULT '{}'");
            }

            // Update version
            this.db.exec(`PRAGMA user_version = ${migration.version}`);
            console.log(`Migration to version ${migration.version} completed successfully`);
            continue;
          } catch (error) {
            console.error('Failed to check/add daily_progress column:', error);
            throw error;
          }
        }
        
        // Special handling for version 8 - add duration_type column to tasks
        if (migration.version === 8) {
          try {
            const tableInfo = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{name: string}>;
            const hasDurationType = tableInfo.some(col => col.name === 'duration_type');

            if (!hasDurationType) {
              console.log('Adding duration_type column to tasks table');
              this.db.exec("ALTER TABLE tasks ADD COLUMN duration_type TEXT NOT NULL DEFAULT 'today'");
            }

            // Update version
            this.db.exec(`PRAGMA user_version = ${migration.version}`);
            console.log(`Migration to version ${migration.version} completed successfully`);
            continue;
          } catch (error) {
            console.error('Failed to check/add duration_type column:', error);
            throw error;
          }
        }
        
        // Special handling for version 9 - add completed_at column to goals
        if (migration.version === 9) {
          try {
            const tableInfo = this.db.prepare('PRAGMA table_info(goals)').all() as Array<{name: string}>;
            const hasCompletedAt = tableInfo.some(col => col.name === 'completed_at');

            if (!hasCompletedAt) {
              console.log('Adding completed_at column to goals table');
              this.db.exec("ALTER TABLE goals ADD COLUMN completed_at TEXT");
            }

            // Update version
            this.db.exec(`PRAGMA user_version = ${migration.version}`);
            console.log(`Migration to version ${migration.version} completed successfully`);
            continue;
          } catch (error) {
            console.error('Failed to check/add completed_at column to goals:', error);
            throw error;
          }
        }
        
        // Special handling for version 10 - add is_paused and paused_at columns to tasks
        if (migration.version === 10) {
          try {
            const tableInfo = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{name: string}>;
            const hasIsPaused = tableInfo.some(col => col.name === 'is_paused');
            const hasPausedAt = tableInfo.some(col => col.name === 'paused_at');

            if (!hasIsPaused) {
              console.log('Adding is_paused column to tasks table');
              this.db.exec("ALTER TABLE tasks ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0");
            }
            
            if (!hasPausedAt) {
              console.log('Adding paused_at column to tasks table');
              this.db.exec("ALTER TABLE tasks ADD COLUMN paused_at TEXT");
            }

            // Update version
            this.db.exec(`PRAGMA user_version = ${migration.version}`);
            console.log(`Migration to version ${migration.version} completed successfully`);
            continue;
          } catch (error) {
            console.error('Failed to check/add is_paused/paused_at columns to tasks:', error);
            throw error;
          }
        }
        
        // Special handling for version 11 - add last_reset_date column to tasks
        if (migration.version === 11) {
          try {
            const tableInfo = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{name: string}>;
            const hasLastResetDate = tableInfo.some(col => col.name === 'last_reset_date');

            if (!hasLastResetDate) {
              console.log('Adding last_reset_date column to tasks table');
              this.db.exec("ALTER TABLE tasks ADD COLUMN last_reset_date TEXT");
            }

            // Update version
            this.db.exec(`PRAGMA user_version = ${migration.version}`);
            console.log(`Migration to version ${migration.version} completed successfully`);
            continue;
          } catch (error) {
            console.error('Failed to check/add last_reset_date column to tasks:', error);
            throw error;
          }
        }
        
        // Run migration in transaction
        const transaction = this.db.transaction(() => {
          try {
            this.db.exec(migration.up);
          } catch (error) {
            if (error instanceof Error) {
              console.error('Migration statement failed:', error.message);
            } else {
              console.error('Migration statement failed:', error);
            }
            throw error;
          }
          
          // Update version
          this.db.exec(`PRAGMA user_version = ${migration.version}`);
        });
        
        try {
          transaction();
          console.log(`Migration to version ${migration.version} completed successfully`);
        } catch (error) {
          if (error instanceof Error) {
            console.error(`Migration to version ${migration.version} failed:`, error.message);
          } else {
            console.error(`Migration to version ${migration.version} failed:`, error);
          }
          throw error;
        }
      }
    }
    
    // Also check completed_at column even if migrations are up to date (for older databases)
    try {
      const tableInfo = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{name: string}>;
      console.log('Post-migration check: tasks table columns:', tableInfo.map(c => c.name).join(', '));
      
      const hasCompletedAt = tableInfo.some(col => col.name === 'completed_at');
      const hasDailyProgress = tableInfo.some(col => col.name === 'daily_progress');
      const hasDurationType = tableInfo.some(col => col.name === 'duration_type');
      const hasIsPaused = tableInfo.some(col => col.name === 'is_paused');
      const hasPausedAt = tableInfo.some(col => col.name === 'paused_at');
      const hasLastResetDate = tableInfo.some(col => col.name === 'last_reset_date');
      
      if (!hasCompletedAt) {
        console.log('Adding missing completed_at column to tasks table (post-migration check)');
        this.db.exec('ALTER TABLE tasks ADD COLUMN completed_at TEXT');
      } else {
        console.log('completed_at column already exists');
      }

      if (!hasDailyProgress) {
        console.log('Adding missing daily_progress column to tasks table (post-migration check)');
        this.db.exec("ALTER TABLE tasks ADD COLUMN daily_progress TEXT NOT NULL DEFAULT '{}'");
      }
      
      if (!hasDurationType) {
        console.log('Adding missing duration_type column to tasks table (post-migration check)');
        this.db.exec("ALTER TABLE tasks ADD COLUMN duration_type TEXT NOT NULL DEFAULT 'today'");
      }
      
      if (!hasIsPaused) {
        console.log('Adding missing is_paused column to tasks table (post-migration check)');
        this.db.exec("ALTER TABLE tasks ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0");
      }
      
      if (!hasPausedAt) {
        console.log('Adding missing paused_at column to tasks table (post-migration check)');
        this.db.exec("ALTER TABLE tasks ADD COLUMN paused_at TEXT");
      }
      
      if (!hasLastResetDate) {
        console.log('Adding missing last_reset_date column to tasks table (post-migration check)');
        this.db.exec("ALTER TABLE tasks ADD COLUMN last_reset_date TEXT");
      }
    } catch (error) {
      console.error('Failed to check/add columns (post-migration):', error);
    }
    
    // Check notes table for pinned column
    try {
      const notesTableInfo = this.db.prepare('PRAGMA table_info(notes)').all() as Array<{name: string}>;
      const hasPinned = notesTableInfo.some(col => col.name === 'pinned');
      
      if (!hasPinned) {
        console.log('Adding missing pinned column to notes table (post-migration check)');
        this.db.exec('ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
      }
    } catch (error) {
      console.error('Failed to check/add pinned column to notes:', error);
    }
  }
  
  private setupBackupSchedule(): void {
    // Create backup every 24 hours
    this.backupInterval = setInterval(() => {
      this.createBackup().catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }
  
  private setupChangeTracking(): void {
    // Additional triggers and setup
    // This can be expanded based on requirements
  }
  
  private async initializeDemoData(): Promise<void> {
    console.log('ProgressDatabase: Checking if demo data is needed');
    
    // Check if database already has data
    const taskCount = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    const goalCount = this.db.prepare('SELECT COUNT(*) as count FROM goals').get() as { count: number };
    const habitCount = this.db.prepare('SELECT COUNT(*) as count FROM habits').get() as { count: number };
    
    if (taskCount.count > 0 || goalCount.count > 0 || habitCount.count > 0) {
      console.log('ProgressDatabase: Database already has data, skipping demo data initialization');
      return;
    }
    
    console.log('ProgressDatabase: Initializing demo data');
    
    const now = new Date().toISOString();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    try {
      // Create demo goals
      const demoGoals = [
        {
          id: crypto.randomUUID(),
          title: 'Complete Personal OS Setup',
          description: 'Set up and customize the Personal OS application for daily productivity',
          category: 'personal',
          priority: 'high',
          status: 'active',
          start_date: now,
          target_date: nextWeek.toISOString(),
          motivation: 'Improve daily productivity and organization',
          review_frequency: 'weekly',
          progress_method: 'task-based',
          progress: 25,
          tags: JSON.stringify(['productivity', 'setup']),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version: 1
        },
        {
          id: crypto.randomUUID(),
          title: 'Learn New Skills',
          description: 'Dedicate time to learning and personal development',
          category: 'learning',
          priority: 'medium',
          status: 'active',
          start_date: now,
          target_date: null,
          motivation: 'Continuous improvement and growth',
          review_frequency: 'monthly',
          progress_method: 'manual',
          progress: 10,
          tags: JSON.stringify(['learning', 'development']),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version: 1
        }
      ];
      
      for (const goal of demoGoals) {
        this.db.prepare(`
          INSERT INTO goals (
            id, title, description, category, priority, status, start_date, target_date,
            motivation, review_frequency, progress_method, progress, tags,
            created_at, updated_at, deleted_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          goal.id, goal.title, goal.description, goal.category, goal.priority, goal.status,
          goal.start_date, goal.target_date, goal.motivation, goal.review_frequency,
          goal.progress_method, goal.progress, goal.tags, goal.created_at, goal.updated_at,
          goal.deleted_at, goal.version
        );
      }
      
      // Create demo tasks
      const demoTasks = [
        {
          id: crypto.randomUUID(),
          title: 'Explore Dashboard Features',
          description: 'Take a tour of the dashboard and familiarize yourself with all features',
          due_date: today.toISOString(),
          priority: 'high',
          status: 'pending',
          progress: 0,
          estimated_time: 30,
          actual_time: null,
          recurrence_rule: null,
          project_id: null,
          goal_id: demoGoals[0].id,
          parent_task_id: null,
          tags: JSON.stringify(['onboarding', 'tutorial']),
          created_at: now,
          updated_at: now,
          completed_at: null,
          deleted_at: null,
          version: 1
        },
        {
          id: crypto.randomUUID(),
          title: 'Create Your First Goal',
          description: 'Navigate to the Goals section and create a personal goal',
          due_date: today.toISOString(),
          priority: 'medium',
          status: 'pending',
          progress: 0,
          estimated_time: 15,
          actual_time: null,
          recurrence_rule: null,
          project_id: null,
          goal_id: demoGoals[0].id,
          parent_task_id: null,
          tags: JSON.stringify(['onboarding', 'goals']),
          created_at: now,
          updated_at: now,
          completed_at: null,
          deleted_at: null,
          version: 1
        },
        {
          id: crypto.randomUUID(),
          title: 'Set Up Daily Habits',
          description: 'Create habits you want to track daily in the Habits section',
          due_date: tomorrow.toISOString(),
          priority: 'medium',
          status: 'pending',
          progress: 0,
          estimated_time: 20,
          actual_time: null,
          recurrence_rule: null,
          project_id: null,
          goal_id: demoGoals[0].id,
          parent_task_id: null,
          tags: JSON.stringify(['onboarding', 'habits']),
          created_at: now,
          updated_at: now,
          completed_at: null,
          deleted_at: null,
          version: 1
        },
        {
          id: crypto.randomUUID(),
          title: 'Review Analytics',
          description: 'Check out the Analytics section to see your progress visualizations',
          due_date: nextWeek.toISOString(),
          priority: 'low',
          status: 'pending',
          progress: 0,
          estimated_time: 10,
          actual_time: null,
          recurrence_rule: null,
          project_id: null,
          goal_id: demoGoals[0].id,
          parent_task_id: null,
          tags: JSON.stringify(['onboarding', 'analytics']),
          created_at: now,
          updated_at: now,
          completed_at: null,
          deleted_at: null,
          version: 1
        }
      ];
      
      for (const task of demoTasks) {
        this.db.prepare(`
          INSERT INTO tasks (
            id, title, description, due_date, priority, status, progress,
            estimated_time, actual_time, recurrence_rule, project_id, goal_id,
            parent_task_id, tags, created_at, updated_at, completed_at, deleted_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id, task.title, task.description, task.due_date, task.priority, task.status,
          task.progress, task.estimated_time, task.actual_time, task.recurrence_rule,
          task.project_id, task.goal_id, task.parent_task_id, task.tags, task.created_at,
          task.updated_at, task.completed_at, task.deleted_at, task.version
        );
      }
      
      // Create demo habits
      const demoHabits = [
        {
          id: crypto.randomUUID(),
          title: 'Morning Review',
          description: 'Review goals and plan the day every morning',
          frequency: 'daily',
          schedule: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
          goal_id: demoGoals[1].id,
          streak_current: 0,
          streak_longest: 0,
          consistency_score: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version: 1
        },
        {
          id: crypto.randomUUID(),
          title: 'Evening Reflection',
          description: 'Reflect on the day and update progress',
          frequency: 'daily',
          schedule: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
          goal_id: demoGoals[1].id,
          streak_current: 0,
          streak_longest: 0,
          consistency_score: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version: 1
        }
      ];
      
      for (const habit of demoHabits) {
        this.db.prepare(`
          INSERT INTO habits (
            id, title, description, frequency, schedule, goal_id,
            streak_current, streak_longest, consistency_score,
            created_at, updated_at, deleted_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          habit.id, habit.title, habit.description, habit.frequency, habit.schedule,
          habit.goal_id, habit.streak_current, habit.streak_longest, habit.consistency_score,
          habit.created_at, habit.updated_at, habit.deleted_at, habit.version
        );
      }
      
      console.log('ProgressDatabase: Demo data initialized successfully');
    } catch (error) {
      console.error('ProgressDatabase: Failed to initialize demo data:', error);
      // Don't throw - allow app to continue even if demo data fails
    }
  }
  
  // Public API methods
  
  executeQuery<T = any>(query: string, params: any[] = []): T[] {
    try {
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = this.db.prepare(query);
        return stmt.all(...params) as T[];
      } else {
        const stmt = this.db.prepare(query);
        const result = stmt.run(...params);
        return result as any;
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }
  
  executeTransaction<T = any>(operations: Array<{query: string, params?: any[]}>): T[] {
    const transaction = this.db.transaction(() => {
      const results: T[] = [];
      for (const op of operations) {
        const stmt = this.db.prepare(op.query);
        if (op.query.trim().toUpperCase().startsWith('SELECT')) {
          results.push(stmt.all(...(op.params || [])) as T);
        } else {
          results.push(stmt.run(...(op.params || [])) as T);
        }
      }
      return results;
    });
    
    try {
      const result = transaction();
      
      // Check if any operation was a DELETE or UPDATE deleted_at (indicating deletion)
      const hasDeleteOps = operations.some(op => {
        const query = op.query.trim().toUpperCase();
        return query.startsWith('DELETE') || (query.includes('UPDATE') && query.includes('deleted_at'));
      });
      
      // Force WAL checkpoint after delete operations to ensure persistence
      if (hasDeleteOps) {
        try {
          this.db.pragma('wal_checkpoint(RESTART)');
          console.log('WAL checkpoint completed after delete operations');
        } catch (error) {
          console.error('WAL checkpoint failed:', error);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Run an arbitrary set of database operations atomically.
   * If the callback throws, the transaction is rolled back.
   */
  runAtomic<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }
  
  getData<T = any>(table: string, where?: Record<string, any>): T[] {
    let query = `SELECT * FROM ${table} WHERE deleted_at IS NULL`;
    const params: any[] = [];
    
    if (where) {
      const conditions = Object.entries(where).map(([key, value], index) => {
        params.push(value);
        return `${key} = ?`;
      });
      query += ` AND ${conditions.join(' AND ')}`;
    }
    
    return this.executeQuery<T>(query, params);
  }
  
  insertData<T = any>(table: string, data: Record<string, any>): T {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    const record: Record<string, any> = {
      id,
      ...data,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => record[col]);
    
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    this.executeQuery(query, values);
    
    // Get the inserted record
    return this.getData<T>(table, { id })[0];
  }
  
  updateData<T = any>(table: string, id: string, data: Record<string, any>): T {
    const now = new Date().toISOString();
    const updates = {
      ...data,
      updated_at: now,
      version: data.version ? data.version + 1 : 2,
    };
    
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const query = `UPDATE ${table} SET ${setClause} WHERE id = ? AND deleted_at IS NULL`;
    
    this.executeQuery(query, values);
    
    // Get the updated record
    return this.getData<T>(table, { id })[0];
  }
  
  deleteData(table: string, id: string, softDelete: boolean = true): boolean {
    try {
      if (softDelete) {
        const query = `UPDATE ${table} SET deleted_at = ? WHERE id = ?`;
        this.executeQuery(query, [new Date().toISOString(), id]);
      } else {
        const query = `DELETE FROM ${table} WHERE id = ?`;
        this.executeQuery(query, [id]);
      }
      
      // Force WAL checkpoint to ensure deletion persists to disk
      try {
        this.db.pragma('wal_checkpoint(RESTART)');
        console.log('WAL checkpoint completed after deleteData');
      } catch (error) {
        console.error('WAL checkpoint failed:', error);
      }
      
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      return false;
    }
  }
  
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(app.getPath('userData'), 'backups');
    await fs.ensureDir(backupDir);
    
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
    
    // Use SQLite backup API
    const backupDb = new Database(backupPath);
    this.db.backup(backupDb as any);
    backupDb.close();
    
    // Calculate checksum
    const fileBuffer = fs.readFileSync(backupPath as string);
    const checksum: any = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    // Record backup
    this.db.prepare(`
      INSERT INTO backups (id, path, timestamp, size, checksum, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      backupPath,
      new Date().toISOString(),
      fs.statSync(backupPath).size,
      checksum,
      1
    );
    
    // Cleanup old backups (keep last 30)
    this.cleanupOldBackups();
    
    return backupPath;
  }
  
  private cleanupOldBackups(): void {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const oldBackups = this.db.prepare(`
      SELECT id, path FROM backups 
      WHERE timestamp < ?
      ORDER BY timestamp ASC
    `).all(cutoff) as Array<{ id: string; path: string }>;
    
    for (const backup of oldBackups) {
      try {
        fs.unlinkSync(backup.path);
        this.db.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
      } catch (error) {
        if (error instanceof Error) {
          console.error('Failed to delete old backup:', error.message);
        } else {
          console.error('Failed to delete old backup:', error);
        }
      }
    }
  }
  
  async restoreBackup(backupId: string): Promise<boolean> {
    try {
      const backup = this.db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId) as Backup;
      if (!backup) {
        throw new Error('Backup not found');
      }
      
      // Verify backup integrity
      const fileBuffer = fs.readFileSync(backup.path);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      if (checksum !== backup.checksum) {
        throw new Error('Backup integrity check failed');
      }
      
      // Close current database
      this.db.close();
      
      // Replace current database with backup
      const currentDbPath = path.join(app.getPath('userData'), 'progress.db');
      await fs.copy(backup.path, currentDbPath);
      
      // Reinitialize database
      await this.initialize();
      
      return true;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Restore failed:', error.message);
      } else {
        console.error('Restore failed:', error);
      }
      return false;
    }
  }
  
  exportData(format: 'json' | 'csv' | 'pdf'): string {
    // Export all data in specified format
    const data = {
      exportDate: new Date().toISOString(),
      version: 1,
      tables: {
        goals: this.getData('goals'),
        projects: this.getData('projects'),
        tasks: this.getData('tasks'),
        habits: this.getData('habits'),
        notes: this.getData('notes'),
      },
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        // Simple CSV conversion
        return this.convertToCSV(data);
      case 'pdf':
        return this.convertToPDF(data);
      default:
        return JSON.stringify(data);
    }
  }
  
  private convertToCSV(data: any): string {
    // Implement CSV conversion
    let csv = 'Table,Data\n';
    for (const [table, rows] of Object.entries(data.tables)) {
      if (Array.isArray(rows) && rows.length > 0) {
        const headers = Object.keys(rows[0]).join(',');
        csv += `${table},${headers}\n`;
        for (const row of rows) {
          const values = Object.values(row).map(v => 
            typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
          ).join(',');
          csv += `${table},${values}\n`;
        }
      }
    }
    return csv;
  }
  
  private convertToPDF(data: any): string {
    // Implement PDF conversion
    // This would require a PDF library like pdfkit
    return JSON.stringify(data);
  }
  
  async importData(data: string, format: 'json' | 'csv'): Promise<boolean> {
    try {
      let parsedData: any;
      
      if (format === 'json') {
        parsedData = JSON.parse(data);
      } else {
        // Parse CSV
        parsedData = this.parseCSV(data);
      }
      
      // Import data in transaction
      const transaction = this.db.transaction(() => {
        for (const [table, rows] of Object.entries(parsedData.tables || {})) {
          if (Array.isArray(rows)) {
            for (const row of rows) {
              this.insertData(table, row);
            }
          }
        }
      });
      
      transaction();
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }
  
  private parseCSV(csv: string): Record<string, any> {
    // Simple CSV parser
    const lines = csv.split('\n').filter(line => line.trim());
    const result: Record<string, any> = { tables: {} };
    
    let currentTable: string | null = null;
    let headers: string[] = [];
    
    for (const line of lines) {
      const [table, ...rest] = line.split(',');
      const data = rest.join(',');
      
      if (table && data) {
        if (!result.tables[table]) {
          result.tables[table] = [] as Array<Record<string, any>>;
        }
        
        if (data.includes(',') && !headers.length) {
          // This is a header row
          headers = data.split(',').map(h => h.trim());
        } else if (headers.length) {
          // This is a data row
          const values = data.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, any> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          result.tables[table].push(row as any);
        }
      }
    }
    
    return result;
  }
  
  close(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    
    if (this.db) {
      try {
        // Force final WAL checkpoint before closing
        console.log('Performing final WAL checkpoint before close...');
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        this.db.close();
        console.log('Database closed successfully');
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
    
    this.isInitialized = false;
  }
  
  // Helper methods for common operations
  
  getActiveGoals(): Goal[] {
    return this.executeQuery<Goal>(`
      SELECT * FROM goals 
      WHERE status = 'active' 
        AND deleted_at IS NULL
      ORDER BY priority, target_date
    `);
  }
  
  getTodayTasks(): Task[] {
    return this.executeQuery<Task>(`
      SELECT * FROM tasks 
      WHERE status != 'completed'
        AND deleted_at IS NULL
        AND (due_date IS NULL OR date(due_date) <= date('now'))
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        due_date
    `);
  }
  
  getHabitsForToday(): Habit[] {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    return this.executeQuery<Habit>(`
      SELECT h.*,
        hc.completed as today_completed
      FROM habits h
      LEFT JOIN habit_completions hc ON h.id = hc.habit_id 
        AND hc.date = date('now')
      WHERE h.deleted_at IS NULL
        AND (
          h.frequency = 'daily'
          OR (h.frequency = 'weekly' AND json_extract(h.schedule, '$') LIKE ?)
          OR (h.frequency = 'monthly' AND CAST(strftime('%d', 'now') AS INTEGER) IN (
            SELECT value FROM json_each(h.schedule)
          ))
        )
      ORDER BY h.consistency_score DESC
    `, [`%${today}%`]);
  }
  
  updateHabitCompletion(habitId: string, date: string, completed: boolean): void {
    const now = new Date().toISOString();
    const dateStr = date.slice(0, 10);

    // Get the habit to check creation date
    const habit = this.db.prepare(`
      SELECT created_at FROM habits WHERE id = ?
    `).get(habitId) as { created_at: string } | undefined;

    if (!habit) {
      throw new Error(`Habit ${habitId} not found`);
    }

    const habitCreatedDate = habit.created_at.slice(0, 10); // YYYY-MM-DD format

    // Validate: don't allow marking dates before habit creation
    if (dateStr < habitCreatedDate) {
      console.warn(`[HABIT] Cannot mark date before habit creation: ${dateStr} < ${habitCreatedDate}`);
      return;
    }

    if (completed) {
      this.db.prepare(`
        INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), habitId, dateStr, 1, null, now);
    } else {
      this.db.prepare(`
        DELETE FROM habit_completions 
        WHERE habit_id = ? AND date = ?
      `).run(habitId, dateStr);
    }

    // Get all completions from habit creation date onward (enforce creation date boundary)
    const completionRows = this.db.prepare(`
      SELECT date FROM habit_completions 
      WHERE habit_id = ? AND completed = 1 AND date >= ?
      ORDER BY date DESC
    `).all(habitId, habitCreatedDate) as Array<{ date: string }>;

    const completedDates = new Set(completionRows.map((row) => row.date?.slice(0, 10)));

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

    // Calculate consistency: count completions from creation date to 30 days ago (or creation date, whichever is later)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    // The calculation window starts from the later of: habit creation date or 30 days ago
    const consistencyStartDate = habitCreatedDate > thirtyDaysAgoStr ? habitCreatedDate : thirtyDaysAgoStr;

    const consistencyCount = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM habit_completions 
      WHERE habit_id = ? 
      AND completed = 1 
      AND date >= ? AND date <= date('now')
    `).get(habitId, consistencyStartDate) as { count: number };

    // Calculate expected days: days from consistency start date to today
    const startDate = new Date(consistencyStartDate);
    const today = new Date();
    const expectedDays = Math.max(1, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const consistencyScore = Math.min(100, Math.round(((consistencyCount?.count || 0) / expectedDays) * 100));

    this.db.prepare(`
      UPDATE habits 
      SET streak_current = ?,
          streak_longest = MAX(?, streak_longest),
          consistency_score = ?,
          updated_at = ?
      WHERE id = ?
    `).run(currentStreak, currentStreak, consistencyScore, now, habitId);
  }
  
  getProgressStats() {
    const stats = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM tasks WHERE (status = 'completed' OR progress IN (25, 50, 75, 100)) AND date(completed_at) = date('now')) as completed_today,
        (SELECT COUNT(*) FROM tasks WHERE (status = 'completed' OR progress IN (25, 50, 75, 100)) AND date(completed_at) >= date('now', '-7 days')) as completed_week,
        (SELECT AVG(progress) FROM goals WHERE status = 'active' AND deleted_at IS NULL) as avg_goal_progress,
        (SELECT AVG(consistency_score) FROM habits WHERE deleted_at IS NULL) as avg_habit_consistency,
        (SELECT COUNT(DISTINCT date) FROM time_blocks WHERE date(start_time) = date('now')) as focus_sessions_today,
        (SELECT SUM(duration) FROM time_blocks WHERE date(start_time) = date('now')) as total_focus_time
    `).get();
    
    return stats;
  }

  // ============ REVIEW SYSTEM METHODS ============
  
  getReviews(type?: string, limit: number = 50): any[] {
    let query = `
      SELECT * FROM reviews 
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    return this.executeQuery(query, params);
  }
  
  getReviewById(id: string): any | null {
    const result = this.executeQuery(
      `SELECT * FROM reviews WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return result[0] || null;
  }
  
  getLatestReview(type: string): any | null {
    const result = this.executeQuery(
      `SELECT * FROM reviews 
       WHERE type = ? AND deleted_at IS NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [type]
    );
    return result[0] || null;
  }
  
  getReviewForPeriod(type: string, periodStart: string, periodEnd: string): any | null {
    const result = this.executeQuery(
      `SELECT * FROM reviews 
       WHERE type = ? 
         AND period_start = ? 
         AND period_end = ?
         AND deleted_at IS NULL 
       LIMIT 1`,
      [type, periodStart, periodEnd]
    );
    return result[0] || null;
  }
  
  createReview(data: {
    type: string;
    period_start: string;
    period_end: string;
    responses?: any;
    insights?: any;
    action_items?: any[];
    tags?: string[];
    mood?: string;
    status?: string;
  }): any {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    this.db.prepare(`
      INSERT INTO reviews (
        id, type, status, period_start, period_end, responses, insights, 
        action_items, tags, mood, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.type,
      data.status || 'draft',
      data.period_start,
      data.period_end,
      JSON.stringify(data.responses || {}),
      JSON.stringify(data.insights || {}),
      JSON.stringify(data.action_items || []),
      JSON.stringify(data.tags || []),
      data.mood || null,
      now,
      now,
      1
    );
    
    return this.getReviewById(id);
  }
  
  updateReview(id: string, data: {
    responses?: any;
    insights?: any;
    action_items?: any[];
    tags?: string[];
    mood?: string;
    status?: string;
  }): any {
    const now = new Date().toISOString();
    const existing = this.getReviewById(id);
    
    if (!existing) {
      throw new Error('Review not found');
    }
    
    const updates: string[] = ['updated_at = ?', 'version = version + 1'];
    const params: any[] = [now];
    
    if (data.responses !== undefined) {
      updates.push('responses = ?');
      params.push(JSON.stringify(data.responses));
    }
    if (data.insights !== undefined) {
      updates.push('insights = ?');
      params.push(JSON.stringify(data.insights));
    }
    if (data.action_items !== undefined) {
      updates.push('action_items = ?');
      params.push(JSON.stringify(data.action_items));
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }
    if (data.mood !== undefined) {
      updates.push('mood = ?');
      params.push(data.mood);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
      if (data.status === 'completed') {
        updates.push('completed_at = ?');
        params.push(now);
      }
    }
    
    params.push(id);
    
    this.db.prepare(`
      UPDATE reviews SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);
    
    return this.getReviewById(id);
  }
  
  deleteReview(id: string): boolean {
    return this.deleteData('reviews', id, true);
  }
  
  // Get insights data for a review period
  getReviewInsights(periodStart: string, periodEnd: string): any {
    const startDate = periodStart.split('T')[0];
    const endDate = periodEnd.split('T')[0];
    
    // ============ TASK INSIGHTS (Using weighted calculations like Task Tab) ============
    const priorityWeight = (priority: string): number => {
      if (priority === 'high') return 3;
      if (priority === 'medium') return 2;
      if (priority === 'low') return 1;
      return 2; // default to medium
    };

    const completionFactor = (progress: number): number => {
      const value = Math.max(0, Math.min(progress ?? 0, 100));
      if (value >= 100) return 1;
      if (value >= 75) return 0.75;
      if (value >= 50) return 0.5;
      if (value >= 25) return 0.25;
      return 0;
    };

    // Get all tasks with their progress data (INCLUDING due_date, estimated_time, actual_time)
    const allTasks = this.db.prepare(`
      SELECT id, title, priority, status, progress, created_at, completed_at, due_date, estimated_time, actual_time, deleted_at
      FROM tasks
      WHERE deleted_at IS NULL
    `).all() as any[];

    // Separate tasks for period analysis
    const tasksInPeriod = allTasks.filter(task => {
      const createdDay = new Date(task.created_at).toISOString().split('T')[0];
      const completedDay = task.completed_at ? new Date(task.completed_at).toISOString().split('T')[0] : null;
      // Include tasks created OR completed in this period
      return (createdDay >= startDate && createdDay <= endDate) || 
             (completedDay && completedDay >= startDate && completedDay <= endDate);
    });

    // Calculate weighted task stats for the period
    let tasksCompleted = 0;
    let tasksCreated = 0;
    let blockedTasksCount = 0;
    let plannedWeight = 0;
    let earnedWeight = 0;
    const completedTasksList: any[] = [];
    const skippedTasksList: any[] = [];
    let totalCompletionTime = 0;
    let completionTimeCount = 0;
    const dayCompletionCounts: Record<string, number> = {};

    tasksInPeriod.forEach((task) => {
      const createdDay = new Date(task.created_at).toISOString().split('T')[0];
      
      // Count tasks created in period
      if (createdDay >= startDate && createdDay <= endDate) {
        tasksCreated++;
      }
      
      // Count blocked tasks
      if (task.status === 'blocked') {
        blockedTasksCount++;
      }

      const weight = priorityWeight(task.priority);
      plannedWeight += weight;
      
      const progress = task.progress ?? 0;
      earnedWeight += weight * completionFactor(progress);
      
      // Count completed (100% progress) in this period
      if (progress >= 100 && task.completed_at) {
        const completedDay = new Date(task.completed_at).toISOString().split('T')[0];
        if (completedDay >= startDate && completedDay <= endDate) {
          tasksCompleted++;
          completedTasksList.push({
            id: task.id,
            title: task.title,
            completedAt: task.completed_at
          });
          
          // Track completion time
          if (task.actual_time) {
            totalCompletionTime += task.actual_time;
            completionTimeCount++;
          }

          // Track productivity by day (get day of week)
          const dayOfWeek = new Date(task.completed_at).toLocaleDateString('en-US', { weekday: 'long' });
          dayCompletionCounts[dayOfWeek] = (dayCompletionCounts[dayOfWeek] || 0) + 1;
        }
      }
      
      // Track skipped/abandoned tasks
      if ((task.status === 'skipped' || task.status === 'blocked') && task.completed_at) {
        const completedDay = new Date(task.completed_at).toISOString().split('T')[0];
        if (completedDay >= startDate && completedDay <= endDate) {
          skippedTasksList.push({
            id: task.id,
            title: task.title,
            reason: task.status === 'blocked' ? 'Blocked' : 'Skipped'
          });
        }
      }
    });

    // Task completion rate (weighted)
    const taskCompletionRate = plannedWeight > 0 
      ? Math.round((earnedWeight / plannedWeight) * 100)
      : 0;

    // Binary task completion counts for combined completion-rate aggregation
    const taskEligibleCount = tasksInPeriod.length;

    // Top completed tasks for period
    const topCompletedTasks = completedTasksList.slice(0, 10);

    // Overdue tasks (due date passed, not completed)
    const overdueTasksCount = allTasks.filter(t => {
      if (!t.completed_at && t.due_date) {
        return t.due_date < new Date().toISOString().split('T')[0] && t.progress < 100;
      }
      return false;
    }).length;

    // Average task completion time
    const avgTaskCompletionTime = completionTimeCount > 0 
      ? Math.round(totalCompletionTime / completionTimeCount * 10) / 10
      : 0;

    // Most productive day
    const mostProductiveDay = Object.entries(dayCompletionCounts).length > 0
      ? Object.entries(dayCompletionCounts).sort((a, b) => b[1] - a[1])[0][0]
      : undefined;

    // ============ HABIT INSIGHTS (Using period-scoped consistency calculation) ============
    
    // Get all habits with their streak data
    const habits = this.db.prepare(`
      SELECT id, title, frequency, deleted_at, created_at, streak_current, streak_longest
      FROM habits
      WHERE deleted_at IS NULL
    `).all() as any[];

    const habitCompletions = this.db.prepare(`
      SELECT habit_id, date, completed
      FROM habit_completions
      WHERE date BETWEEN ? AND ?
    `).all(startDate, endDate) as any[];

    // Helper to get period key
    const getHabitPeriodKey = (dateStr: string, frequency: 'daily' | 'weekly' | 'monthly'): string => {
      const date = new Date(dateStr);
      if (frequency === 'daily') {
        return dateStr;
      } else if (frequency === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)); // Monday start
        return weekStart.toISOString().split('T')[0];
      } else if (frequency === 'monthly') {
        return dateStr.substring(0, 7); // YYYY-MM
      }
      return dateStr;
    };

    // Calculate habit consistency and track individual counts
    let expectedPeriods = 0;
    let completedPeriods = 0;
    let habitsCompleted = 0;
    let habitsMissed = 0;
    const brokenStreaks: any[] = [];
    const prevHabitCompletions = this.db.prepare(`
      SELECT habit_id, date, completed
      FROM habit_completions
      WHERE date < ?
      ORDER BY date DESC
      LIMIT ? 
    `).all(startDate, habits.length * 30) as any[];

    habits.forEach(habit => {
      const createdDate = new Date(habit.created_at).toISOString().split('T')[0];
      const effectiveStart = createdDate > startDate ? createdDate : startDate;
      const effectiveEnd = endDate;

      if (effectiveStart <= effectiveEnd) {
        // Get all expected periods for this habit
        const expectedKeys = new Set<string>();
        let cursor = new Date(effectiveStart);
        const endDateObj = new Date(effectiveEnd);

        while (cursor <= endDateObj) {
          expectedKeys.add(getHabitPeriodKey(cursor.toISOString().split('T')[0], habit.frequency));
          cursor.setDate(cursor.getDate() + 1);
        }

        expectedPeriods += expectedKeys.size;

        // Get completed periods for this habit
        const completedKeys = new Set<string>();
        habitCompletions
          .filter(c => c.habit_id === habit.id && c.completed === 1)
          .forEach(c => {
            completedKeys.add(getHabitPeriodKey(c.date, habit.frequency));
          });

        completedPeriods += completedKeys.size;
        
        // Count individual completed/missed expectations
        const periodCompletionRate = expectedKeys.size > 0 
          ? Math.round((completedKeys.size / expectedKeys.size) * 100)
          : 0;
        
        if (periodCompletionRate === 100) {
          habitsCompleted++;
        } else if (periodCompletionRate === 0) {
          habitsMissed++;
        }

        // Check for broken streaks (compare with previous period)
        const prevStartDate = new Date(startDate);
        const periodLength = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
        prevStartDate.setDate(prevStartDate.getDate() - periodLength);
        const prevPeriodEnd = new Date(startDate);
        prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
        const prevPeriodEndStr = prevPeriodEnd.toISOString().split('T')[0];

        // Get the last completion before this period
        const lastCompletionBefore = prevHabitCompletions
          .filter(c => c.habit_id === habit.id && c.date <= prevPeriodEndStr && c.completed === 1)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        // If there was a streak before and now it's broken
        if (lastCompletionBefore && habit.streak_current === 0 && habit.streak_longest > 0) {
          brokenStreaks.push({
            id: habit.id,
            title: habit.title,
            previousStreak: habit.streak_longest
          });
        }
      }
    });

    const habitConsistencyRate = expectedPeriods > 0
      ? Math.round((completedPeriods / expectedPeriods) * 100)
      : 0;

    // Combined completion rate uses strict count-based aggregation across tasks + habit periods
    const combinedCompletionDenominator = taskEligibleCount + expectedPeriods;
    const combinedCompletionNumerator = tasksCompleted + completedPeriods;
    const combinedCompletionRate = combinedCompletionDenominator > 0
      ? Math.round((combinedCompletionNumerator / combinedCompletionDenominator) * 100)
      : 0;

    // Current streaks (all active habits)
    const currentStreaks = this.db.prepare(`
      SELECT id, title, streak_current as streak
      FROM habits
      WHERE deleted_at IS NULL AND streak_current > 0
      ORDER BY streak_current DESC
      LIMIT 5
    `).all() as any[];

    // Habit trend (compare with previous period)
    const prevHabitStartDate = new Date(startDate);
    const prevHabitEndDate = new Date(startDate);
    prevHabitEndDate.setDate(prevHabitEndDate.getDate() - 1);
    const prevPeriodLength = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    prevHabitStartDate.setDate(prevHabitStartDate.getDate() - prevPeriodLength);

    const prevHabitStr = prevHabitStartDate.toISOString().split('T')[0];
    const prevHabitEndStr = prevHabitEndDate.toISOString().split('T')[0];
    const prevPeriodHabitCompletions = this.db.prepare(`
      SELECT habit_id, date, completed
      FROM habit_completions
      WHERE date BETWEEN ? AND ?
    `).all(prevHabitStr, prevHabitEndStr) as any[];

    let prevExpectedHabitPeriods = 0;
    let prevCompletedHabitPeriods = 0;

    habits.forEach(habit => {
      const createdDate = new Date(habit.created_at).toISOString().split('T')[0];
      const effectiveStart = createdDate > prevHabitStr ? createdDate : prevHabitStr;
      const effectiveEnd = prevHabitEndStr;

      if (effectiveStart <= effectiveEnd) {
        const expectedKeys = new Set<string>();
        let cursor = new Date(effectiveStart);
        const endDateObj = new Date(effectiveEnd);

        while (cursor <= endDateObj) {
          expectedKeys.add(getHabitPeriodKey(cursor.toISOString().split('T')[0], habit.frequency));
          cursor.setDate(cursor.getDate() + 1);
        }

        prevExpectedHabitPeriods += expectedKeys.size;

        const completedKeys = new Set<string>();
        prevPeriodHabitCompletions
          .filter(c => c.habit_id === habit.id && c.completed === 1)
          .forEach(c => {
            completedKeys.add(getHabitPeriodKey(c.date, habit.frequency));
          });

        prevCompletedHabitPeriods += completedKeys.size;
      }
    });

    const prevHabitRate = prevExpectedHabitPeriods > 0 
      ? prevCompletedHabitPeriods / prevExpectedHabitPeriods
      : 0;
    const currentHabitRate = expectedPeriods > 0 
      ? completedPeriods / expectedPeriods
      : 0;

    let habitTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (prevExpectedHabitPeriods > 0) {
      const habitPercentChange = ((currentHabitRate - prevHabitRate) / prevHabitRate) * 100;
      if (habitPercentChange > 10) habitTrend = 'improving';
      else if (habitPercentChange < -10) habitTrend = 'declining';
    }

    // ============ GOAL INSIGHTS ============

    // Goals at risk (active goals with low progress or approaching deadline)
    const goalsAtRisk = this.db.prepare(`
      SELECT id, title, progress, target_date
      FROM goals
      WHERE status = 'active' 
        AND deleted_at IS NULL
        AND target_date IS NOT NULL
        AND progress < 50
    `).all() as any[];

    // Goals completed this period
    const goalsCompletedThisPeriod = this.db.prepare(`
      SELECT id, title, progress
      FROM goals
      WHERE status = 'completed'
        AND deleted_at IS NULL
        AND updated_at BETWEEN datetime(?) AND datetime(?)
    `).all(startDate, endDate) as any[];

    // Active goals progress
    const activeGoalsProgress = this.db.prepare(`
      SELECT id, title, progress
      FROM goals
      WHERE status = 'active'
        AND deleted_at IS NULL
    `).all() as any[];

    // Calculate progress change for active goals
    const activeGoalsWithChange = activeGoalsProgress.map((goal: any) => {
      // Get previous progress (7 days ago for daily, or 1 week for weekly, etc.)
      const prevCheck = this.db.prepare(`
        SELECT progress
        FROM goals
        WHERE id = ?
        LIMIT 1
      `).get(goal.id) as any;
      
      const change = prevCheck ? goal.progress - prevCheck.progress : 0;
      return {
        id: goal.id,
        title: goal.title,
        progress: goal.progress,
        change
      };
    });

    // Productivity trend (compare previous period based on task completion)
    const previousPeriodStart = new Date(startDate);
    const periodLength = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodLength);
    const prevStartDate = previousPeriodStart.toISOString().split('T')[0];

    let prevEarnedWeight = 0;
    let prevPlannedWeight = 0;

    allTasks.forEach((task) => {
      const createdDay = new Date(task.created_at).toISOString().split('T')[0];
      const completedDay = task.completed_at ? new Date(task.completed_at).toISOString().split('T')[0] : null;
      
      // Include tasks from previous period by creation or completion
      if ((createdDay >= prevStartDate && createdDay < startDate) ||
          (completedDay && completedDay >= prevStartDate && completedDay < startDate)) {
        const weight = priorityWeight(task.priority);
        prevPlannedWeight += weight;
        prevEarnedWeight += weight * completionFactor(task.progress ?? 0);
      }
    });

    const prevRate = prevPlannedWeight > 0 ? (prevEarnedWeight / prevPlannedWeight) : 0;
    const currentRate = plannedWeight > 0 ? (earnedWeight / plannedWeight) : 0;

    let productivityTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (prevPlannedWeight > 0) {
      const percentChange = ((currentRate - prevRate) / prevRate) * 100;
      if (percentChange > 10) productivityTrend = 'improving';
      else if (percentChange < -10) productivityTrend = 'declining';
    }

    // Consistency score (overall consistency across all areas)
    const consistencyScore = Math.round((taskCompletionRate * 0.4 + habitConsistencyRate * 0.4 + 
      (activeGoalsWithChange.length > 0 ? 
        Math.round(activeGoalsWithChange.reduce((sum, g) => sum + g.progress, 0) / activeGoalsWithChange.length) 
      : 0) * 0.2));

    return {
      tasksCompleted,
      tasksCreated,
      taskCompletionRate,
      taskEligibleCount,
      overdueTasksCount,
      blockedTasksCount,
      avgTaskCompletionTime,
      topCompletedTasks,
      skippedOrAbandonedTasks: skippedTasksList,
      
      habitConsistencyRate,
      habitsCompleted,
      habitsMissed,
      habitPeriodsCompleted: completedPeriods,
      habitPeriodsExpected: expectedPeriods,
      currentStreaks: currentStreaks.map(h => ({
        id: h.id,
        title: h.title,
        streak: h.streak
      })),
      brokenStreaks,
      habitTrend,
      
      activeGoalsProgress: activeGoalsWithChange,
      goalsCompletedThisPeriod: goalsCompletedThisPeriod.length,
      goalsAtRisk: goalsAtRisk.map(g => ({
        id: g.id,
        title: g.title,
        progress: g.progress,
        reason: `${g.progress}% complete`
      })),
      
      mostProductiveDay,
      productivityTrend,
      consistencyScore,
      combinedCompletionRate,
      periodStart,
      periodEnd,
    };
  }
  
  // Get review history with aggregated stats
  getReviewHistory(type?: string, startDate?: string, endDate?: string): any[] {
    let query = `
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM reviews r2 WHERE r2.type = r.type AND r2.deleted_at IS NULL) as total_reviews
      FROM reviews r
      WHERE r.deleted_at IS NULL
    `;
    const params: any[] = [];
    
    if (type) {
      query += ` AND r.type = ?`;
      params.push(type);
    }
    
    if (startDate) {
      query += ` AND r.period_start >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND r.period_end <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    return this.executeQuery(query, params);
  }
}

// Singleton instance
let dbInstance: ProgressDatabase | null = null;

export async function initDatabase(): Promise<ProgressDatabase> {
  if (!dbInstance) {
    dbInstance = new ProgressDatabase();
    await dbInstance.initialize();
  }
  return dbInstance;
}

export function getDatabase(): ProgressDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}