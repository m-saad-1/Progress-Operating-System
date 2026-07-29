const fs = require('fs');

let content = fs.readFileSync('src/lib/database.ts', 'utf-8');

// 1. Add import Database from '@tauri-apps/plugin-sql' and invoke
const importIdx = content.indexOf('import { endOfMonth');
content = "import Database from '@tauri-apps/plugin-sql';\nimport { invoke } from '@tauri-apps/api/core';\n" + content.substring(importIdx);

// 2. Replace the DatabaseService methods cleanly
// We will replace the entire blocks for initialize, executeQuery, executeTransaction, and the 3 backup methods.
const classStart = content.indexOf('class DatabaseService {');

// A safer way to do this is to replace ONLY the implementations of these methods.
// But since the original file uses window.electronAPI everywhere internally in those 6 methods, we can just rewrite them exactly.

const newMethods = `
  private db: Database | null = null;
  private encryptionKey: string | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.db = await Database.load('sqlite:progress.db');
      
      // Enable WAL mode for better concurrency and crash recovery
      await this.db.execute('PRAGMA journal_mode = WAL');
      await this.db.execute('PRAGMA foreign_keys = ON');
      await this.db.execute('PRAGMA secure_delete = ON');
      await this.db.execute('PRAGMA synchronous = NORMAL');
      await this.db.execute('PRAGMA cache_size = -2000');
      
      this.isInitialized = true;
      console.log('Database service initialized via Tauri Plugin SQL');
    } catch (error) {
      console.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  private async executeQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
    
    try {
      if (query.trim().toUpperCase().startsWith('SELECT') || query.trim().toUpperCase().startsWith('PRAGMA')) {
        const result = await this.db.select(query, params) as T[];
        return result;
      } else {
        await this.db.execute(query, params);
        return [];
      }
    } catch (error) {
      console.error('Database query failed:', error);
      throw error;
    }
  }

  private async executeTransaction(operations: Array<{query: string, params?: any[]}>): Promise<void> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
    
    try {
      await this.db.execute('BEGIN TRANSACTION');
      for (const op of operations) {
        await this.db.execute(op.query, op.params || []);
      }
      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK').catch(e => console.error('Failed to rollback transaction:', e));
      console.error('Database transaction failed:', error);
      throw error;
    }
  }
`;

// Replace from `class DatabaseService {` up to `// Goals CRUD`
const targetStr = `class DatabaseService {`;
const endStr = `// Goals CRUD`;

const startIndex = content.indexOf(targetStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + `class DatabaseService {` + newMethods + `\n  ` + content.substring(endIndex);
}

// 3. Now replace the backup methods. We will find them one by one.
const backupMethodsRegex = /async createBackup\(\): Promise<any> \{[\s\S]*?async listBackups\(\): Promise<Backup\[\]> \{[\s\S]*?\n  \}/;
const newBackupMethods = `async createBackup(): Promise<any> {
    return invoke('create_backup').catch(e => ({ success: false, error: String(e) }));
  }

  async restoreBackup(backupId: string): Promise<boolean> {
    return invoke('restore_backup', { backupId }).catch(e => false);
  }

  async listBackups(): Promise<Backup[]> {
    return invoke('list_backups').catch(e => []);
  }`;

content = content.replace(backupMethodsRegex, newBackupMethods);

fs.writeFileSync('src/lib/database.ts', content);
