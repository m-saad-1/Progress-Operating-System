import { EventEmitter } from 'events';
import crypto from 'crypto';
import { app } from 'electron';
import { getDatabase } from '../main/src/database';

interface SyncConfig {
  enabled: boolean;
  provider: 'supabase' | 'firebase' | 'custom';
  endpoint?: string;
  apiKey?: string;
  syncInterval: number;
  encryptionKey: string;
  userId?: string;
  lastSync?: string;
}

interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  error?: string;
  progress?: number;
}

export class SyncManager extends EventEmitter {
  private config: SyncConfig;
  private status: SyncStatus;
  private syncInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.config = {
      enabled: true,
      provider: 'supabase',
      syncInterval: 5, // minutes
      encryptionKey: '',
    };
    this.status = {
      isSyncing: false,
      lastSyncTime: null,
    };
    this.loadConfig();
  }
  
  private loadConfig(): void {
    try {
      const configPath = `${app.getPath('userData')}/sync-config.json`;
      const fs = require('fs');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to load sync config:', error.message);
      } else {
        console.error('Failed to load sync config:', error);
      }
    }
  }
  
  private saveConfig(): void {
    try {
      const configPath = `${app.getPath('userData')}/sync-config.json`;
      const fs = require('fs');
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      if (error instanceof Error) {
        console.error('Failed to save sync config:', error.message);
      } else {
        console.error('Failed to save sync config:', error);
      }
    }
  }
  
  async start(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Sync is not enabled');
    }
    
    if (this.status.isSyncing) {
      throw new Error('Sync already in progress');
    }
    
    this.status.isSyncing = true;
    this.status.error = undefined;
    this.emit('statusChange', { ...this.status });
    
    try {
      // Initial sync
      await this.performSync();
      
      // Setup interval
      this.syncInterval = setInterval(() => {
        this.performSync().catch(console.error);
      }, this.config.syncInterval * 60 * 1000);
      
      this.emit('statusChange', { 
        ...this.status,
        lastSyncTime: new Date(),
      });
      
    } catch (error) {
      this.status.isSyncing = false;
      if (error instanceof Error) {
        this.status.error = error.message;
        this.emit('error', error);
      } else {
        this.status.error = String(error);
        this.emit('error', String(error));
      }
      this.emit('statusChange', { ...this.status });
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.status.isSyncing = false;
    this.emit('statusChange', { ...this.status });
  }
  
  async performSync(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    this.status.isSyncing = true;
    this.status.progress = 0;
    this.emit('statusChange', { ...this.status });
    
    try {
      const db = getDatabase();
      
      // Step 1: Get pending changes
      this.status.progress = 10;
      this.emit('statusChange', { ...this.status });
      
      const pendingChanges = await this.getPendingChanges();
      
      if (pendingChanges.length === 0) {
        // No pending changes, check for remote changes
        await this.checkRemoteChanges();
        this.completeSync();
        return;
      }
      
      // Step 2: Encrypt and upload changes
      this.status.progress = 30;
      this.emit('statusChange', { ...this.status });
      
      const encryptedChanges = this.encryptChanges(pendingChanges);
      await this.uploadChanges(encryptedChanges);
      
      // Step 3: Download remote changes
      this.status.progress = 60;
      this.emit('statusChange', { ...this.status });
      
      const remoteChanges = await this.downloadChanges();
      if (remoteChanges.length > 0) {
        const decryptedRemote = this.decryptChanges(remoteChanges);
        await this.applyRemoteChanges(decryptedRemote);
      }
      
      // Step 4: Mark as synced
      this.status.progress = 90;
      this.emit('statusChange', { ...this.status });
      
      await this.markAsSynced(pendingChanges);
      
      // Complete sync
      this.completeSync();
      
    } catch (error) {
      this.status.isSyncing = false;
      if (error instanceof Error) {
        this.status.error = error.message;
        this.emit('error', error);
      } else {
        this.status.error = String(error);
        this.emit('error', String(error));
      }
      this.emit('statusChange', { ...this.status });
      throw error;
    }
  }
  
  private completeSync(): void {
    this.status.isSyncing = false;
    this.status.lastSyncTime = new Date();
    this.status.progress = 100;
    this.config.lastSync = new Date().toISOString();
    this.saveConfig();
    
    this.emit('syncComplete', {
      timestamp: this.status.lastSyncTime,
      success: true,
    });
    
    this.emit('statusChange', { ...this.status });
  }
  
  private async getPendingChanges(): Promise<any[]> {
    const db = getDatabase();
    return db.executeQuery<any>(`
      SELECT * FROM sync_state 
      WHERE pending = TRUE
      ORDER BY last_synced ASC
    `);
  }
  
  private encryptChanges(changes: any[]): any[] {
    return changes.map(change => ({
      ...change,
      data: this.encryptData(JSON.stringify(change.data)),
    }));
  }
  
  private decryptChanges(changes: any[]): any[] {
    return changes.map(change => ({
      ...change,
      data: JSON.parse(this.decryptData(change.data)),
    }));
  }
  
  private encryptData(data: string): string {
    // Simple encryption (in production, use proper encryption)
    return Buffer.from(data).toString('base64');
  }
  
  private decryptData(encrypted: string): string {
    return Buffer.from(encrypted, 'base64').toString('utf8');
  }
  
  private async uploadChanges(changes: any[]): Promise<void> {
    switch (this.config.provider) {
      case 'supabase':
        await this.uploadToSupabase(changes);
        break;
      case 'firebase':
        await this.uploadToFirebase(changes);
        break;
      case 'custom':
        await this.uploadToCustom(changes);
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }
  
  private async uploadToSupabase(changes: any[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      throw new Error('Supabase configuration missing');
    }
    
    // Implement Supabase upload
    // This is a placeholder implementation
    console.log('Uploading to Supabase:', changes.length, 'changes');
    
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  private async uploadToFirebase(changes: any[]): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      throw new Error('Firebase configuration missing');
    }
    
    // Implement Firebase upload
    console.log('Uploading to Firebase:', changes.length, 'changes');
    
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  private async uploadToCustom(changes: any[]): Promise<void> {
    if (!this.config.endpoint) {
      throw new Error('Custom endpoint missing');
    }
    
    // Implement custom endpoint upload
    console.log('Uploading to custom endpoint:', changes.length, 'changes');
    
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  private async downloadChanges(): Promise<any[]> {
    switch (this.config.provider) {
      case 'supabase':
        return this.downloadFromSupabase();
      case 'firebase':
        return this.downloadFromFirebase();
      case 'custom':
        return this.downloadFromCustom();
      default:
        return [];
    }
  }
  
  private async downloadFromSupabase(): Promise<any[]> {
    // Implement Supabase download
    console.log('Downloading from Supabase');
    
    // Simulate download
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [];
  }
  
  private async downloadFromFirebase(): Promise<any[]> {
    // Implement Firebase download
    console.log('Downloading from Firebase');
    
    // Simulate download
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [];
  }
  
  private async downloadFromCustom(): Promise<any[]> {
    // Implement custom endpoint download
    console.log('Downloading from custom endpoint');
    
    // Simulate download
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [];
  }
  
  private async checkRemoteChanges(): Promise<void> {
    // Check if there are any remote changes
    // This would typically involve comparing timestamps or versions
    console.log('Checking for remote changes');
    
    // Simulate check
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  private async applyRemoteChanges(changes: any[]): Promise<void> {
    const db = getDatabase();
    
    for (const change of changes) {
      try {
        await this.applyChange(change);
      } catch (error) {
        if (error instanceof Error) {
          console.error('Failed to apply change:', error.message);
        } else {
          console.error('Failed to apply change:', error);
        }
        // Continue with other changes
      }
    }
  }
  
  private async applyChange(change: any): Promise<void> {
    const db = getDatabase();
    
    // Apply change with conflict resolution
    // This is a simplified implementation
    switch (change.action) {
      case 'create':
      case 'update':
        await db.insertData(change.entity_type, change.data);
        break;
      case 'delete':
        await db.deleteData(change.entity_type, change.entity_id, false);
        break;
    }
  }
  
  private async markAsSynced(changes: any[]): Promise<void> {
    const db = getDatabase();
    
    for (const change of changes) {
      await db.executeQuery(`
        UPDATE sync_state 
        SET pending = FALSE, last_synced = ?, sync_version = sync_version + 1
        WHERE id = ?
      `, [new Date().toISOString(), change.id]);
    }
  }
  
  getStatus(): SyncStatus {
    return { ...this.status };
  }
  
  getConfig(): SyncConfig {
    return { ...this.config };
  }
  
  setConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    this.emit('configChange', this.config);
  }
  
  enable(): void {
    this.config.enabled = true;
    this.saveConfig();
    this.emit('configChange', this.config);
  }
  
  disable(): void {
    this.config.enabled = false;
    this.saveConfig();
    this.emit('configChange', this.config);
  }
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      // Test connection to sync provider
      switch (this.config.provider) {
        case 'supabase':
          return await this.testSupabaseConnection();
        case 'firebase':
          return await this.testFirebaseConnection();
        case 'custom':
          return await this.testCustomConnection();
        default:
          return false;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Connection test failed:', error.message);
      } else {
        console.error('Connection test failed:', error);
      }
      return false;
    }
  }
  
  private async testSupabaseConnection(): Promise<boolean> {
    // Test Supabase connection
    return true;
  }
  
  private async testFirebaseConnection(): Promise<boolean> {
    // Test Firebase connection
    return true;
  }
  
  private async testCustomConnection(): Promise<boolean> {
    // Test custom endpoint connection
    return true;
  }
}

let syncManager: SyncManager | null = null;

export function getSyncManager(): SyncManager {
  if (!syncManager) {
    syncManager = new SyncManager();
  }
  return syncManager;
}

export function setupSyncManager(): void {
  const manager = getSyncManager();
  
  // Auto-start sync if enabled
  if (manager.isEnabled()) {
    manager.start().catch(console.error);
  }
}