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
    
    // Setup backup schedule
    this.setupBackupSchedule();
    
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
            COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
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
          WHERE t.status != 'completed'
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
    ];
    
    // Run migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration to version ${migration.version}`);
        
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
      return transaction();
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
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
      this.db.close();
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
    
    if (completed) {
      this.db.prepare(`
        INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), habitId, date, 1, null, now);
      
      // Update streak
      this.db.prepare(`
        UPDATE habits 
        SET streak_current = streak_current + 1,
            streak_longest = MAX(streak_current + 1, streak_longest),
            consistency_score = (
              SELECT 
                (COUNT(CASE WHEN completed = 1 THEN 1 END) * 100.0 / COUNT(*))
              FROM habit_completions 
              WHERE habit_id = ?
                AND date >= date('now', '-30 days')
            ),
            updated_at = ?
        WHERE id = ?
      `).run(habitId, now, habitId);
    } else {
      this.db.prepare(`
        DELETE FROM habit_completions 
        WHERE habit_id = ? AND date = ?
      `).run(habitId, date);
      
      // Reset streak if breaking current streak
      this.db.prepare(`
        UPDATE habits 
        SET streak_current = 0,
            updated_at = ?
        WHERE id = ?
      `).run(now, habitId);
    }
  }
  
  getProgressStats() {
    const stats = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND date(completed_at) = date('now')) as completed_today,
        (SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND date(completed_at) >= date('now', '-7 days')) as completed_week,
        (SELECT AVG(progress) FROM goals WHERE status = 'active' AND deleted_at IS NULL) as avg_goal_progress,
        (SELECT AVG(consistency_score) FROM habits WHERE deleted_at IS NULL) as avg_habit_consistency,
        (SELECT COUNT(DISTINCT date) FROM time_blocks WHERE date(start_time) = date('now')) as focus_sessions_today,
        (SELECT SUM(duration) FROM time_blocks WHERE date(start_time) = date('now')) as total_focus_time
    `).get();
    
    return stats;
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