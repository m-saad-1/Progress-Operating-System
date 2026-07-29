const fs = require('fs');
let content = fs.readFileSync('src/lib/database.ts', 'utf-8');

// Replace mock block with Database import
const mockBlockEnd = content.indexOf('import { endOfMonth');
if (mockBlockEnd !== -1) {
  content = "import Database from '@tauri-apps/plugin-sql';\nimport { invoke } from '@tauri-apps/api/core';\n" + content.substring(mockBlockEnd);
}

// Update class declaration
content = content.replace(/class DatabaseService \{/, `class DatabaseService {
  private db: Database | null = null;`);

// Update initialize method
content = content.replace(/async initialize\(\): Promise<void> \{[\s\S]*?console\.log\('Database service initialized'\);\s*\} catch \(error\) \{[\s\S]*?throw error;\s*\}\s*\}/, 
`async initialize(): Promise<void> {
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
  }`);

// Update executeQuery method
content = content.replace(/private async executeQuery[\s\S]*?throw error;\s*\}/,
`private async executeQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
    
    try {
      if (query.trim().toUpperCase().startsWith('SELECT') || query.trim().toUpperCase().startsWith('PRAGMA')) {
        const result = await this.db!.select<T[]>(query, params);
        return result;
      } else {
        await this.db!.execute(query, params);
        return [];
      }
    } catch (error) {
      console.error('Database query failed:', error);
      throw error;
    }
  }`);

// Update executeTransaction method
content = content.replace(/private async executeTransaction[\s\S]*?throw error;\s*\}/,
`private async executeTransaction(operations: Array<{query: string, params?: any[]}>): Promise<void> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
    
    try {
      await this.db!.execute('BEGIN TRANSACTION');
      for (const op of operations) {
        await this.db!.execute(op.query, op.params || []);
      }
      await this.db!.execute('COMMIT');
    } catch (error) {
      await this.db!.execute('ROLLBACK').catch(e => console.error('Failed to rollback transaction:', e));
      console.error('Database transaction failed:', error);
      throw error;
    }
  }`);

// Update backup methods
content = content.replace(/async createBackup\(\): Promise<any> \{[\s\S]*?\}/,
`async createBackup(): Promise<any> {
    return invoke('create_backup').catch(e => ({ success: false, error: e.message || String(e) }));
  }`);

content = content.replace(/async restoreBackup\(backupId: string\): Promise<boolean> \{[\s\S]*?\}/,
`async restoreBackup(backupId: string): Promise<boolean> {
    return invoke('restore_backup', { backupId }).catch(e => false);
  }`);

content = content.replace(/async listBackups\(\): Promise<Backup\[\]> \{[\s\S]*?\}/,
`async listBackups(): Promise<Backup[]> {
    return invoke('list_backups').catch(e => []);
  }`);

fs.writeFileSync('src/lib/database.ts', content);
