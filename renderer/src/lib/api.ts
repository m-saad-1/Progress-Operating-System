// API client for REST API calls (for optional cloud sync)
import { database, type Goal, type Task, type Habit, type Note } from './database'

export interface SyncConfig {
  enabled: boolean
  provider: 'supabase' | 'firebase' | 'custom'
  endpoint: string
  apiKey: string
  syncInterval: number
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error'
  lastSync: string | null
  pendingChanges: number
  error?: string
}

export class ApiClient {
  private config: SyncConfig | null = null
  private isSyncing = false
  private syncIntervalId: NodeJS.Timeout | null = null

  constructor() {}

  async initialize(config: SyncConfig): Promise<void> {
    this.config = config
    
    if (config.enabled) {
      // Start sync interval
      this.startSyncInterval()
    }
  }

  private startSyncInterval(): void {
    if (!this.config || !this.config.enabled || this.syncIntervalId) {
      return
    }

    this.syncIntervalId = setInterval(() => {
      this.sync().catch(console.error)
    }, this.config.syncInterval * 60 * 1000)
  }

  async stop(): Promise<void> {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId)
      this.syncIntervalId = null
    }
  }

  async sync(): Promise<SyncStatus> {
    if (!this.config || !this.config.enabled || this.isSyncing) {
      return {
        status: 'idle',
        lastSync: null,
        pendingChanges: 0,
      }
    }

    this.isSyncing = true

    try {
      // Get pending changes from local database
      const pendingChanges = await this.getPendingChanges()
      
      if (pendingChanges.length === 0) {
        return {
          status: 'idle',
          lastSync: new Date().toISOString(),
          pendingChanges: 0,
        }
      }

      // Push changes to cloud
      await this.pushChanges(pendingChanges)

      // Pull changes from cloud
      const remoteChanges = await this.pullChanges()
      await this.applyRemoteChanges(remoteChanges)

      return {
        status: 'idle',
        lastSync: new Date().toISOString(),
        pendingChanges: 0,
      }

    } catch (error) {
      console.error('Sync failed:', error)
      return {
        status: 'error',
        lastSync: null,
        pendingChanges: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      this.isSyncing = false
    }
  }

  private async getPendingChanges(): Promise<any[]> {
    // In a real implementation, this would query a sync_state table
    // For now, return empty array
    return []
  }

  private async pushChanges(changes: any[]): Promise<void> {
    if (!this.config) {
      throw new Error('Sync not configured')
    }

    switch (this.config.provider) {
      case 'supabase':
        await this.pushToSupabase(changes)
        break
      case 'firebase':
        await this.pushToFirebase(changes)
        break
      case 'custom':
        await this.pushToCustom(changes)
        break
      default:
        throw new Error(`Unsupported sync provider: ${this.config.provider}`)
    }
  }

  private async pullChanges(): Promise<any[]> {
    if (!this.config) {
      throw new Error('Sync not configured')
    }

    switch (this.config.provider) {
      case 'supabase':
        return this.pullFromSupabase()
      case 'firebase':
        return this.pullFromFirebase()
      case 'custom':
        return this.pullFromCustom()
      default:
        throw new Error(`Unsupported sync provider: ${this.config.provider}`)
    }
  }

  private async applyRemoteChanges(changes: any[]): Promise<void> {
    for (const change of changes) {
      await this.applyChange(change)
    }
  }

  private async applyChange(change: any): Promise<void> {
    // Apply change with conflict resolution
    // This is a simplified implementation
    console.log('Applying remote change:', change)
  }

  // Supabase implementation
  private async pushToSupabase(changes: any[]): Promise<void> {
    if (!this.config) return

    const response = await fetch(`${this.config.endpoint}/rest/v1/changes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.config.apiKey,
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ changes }),
    })

    if (!response.ok) {
      throw new Error(`Supabase push failed: ${response.statusText}`)
    }
  }

  private async pullFromSupabase(): Promise<any[]> {
    if (!this.config) return []

    const response = await fetch(`${this.config.endpoint}/rest/v1/changes?order=created_at.desc&limit=100`, {
      headers: {
        'apikey': this.config.apiKey,
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase pull failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data || []
  }

  // Firebase implementation
  private async pushToFirebase(changes: any[]): Promise<void> {
    // Firebase implementation would go here
    console.log('Pushing to Firebase:', changes)
  }

  private async pullFromFirebase(): Promise<any[]> {
    // Firebase implementation would go here
    return []
  }

  // Custom API implementation
  private async pushToCustom(changes: any[]): Promise<void> {
    if (!this.config) return

    const response = await fetch(`${this.config.endpoint}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ changes }),
    })

    if (!response.ok) {
      throw new Error(`Custom API push failed: ${response.statusText}`)
    }
  }

  private async pullFromCustom(): Promise<any[]> {
    if (!this.config) return []

    const response = await fetch(`${this.config.endpoint}/sync/pull`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Custom API pull failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data?.changes || []
  }

  // Backup to cloud
  async backupToCloud(): Promise<string> {
    if (!this.config) {
      throw new Error('Sync not configured')
    }

    const data = await database.exportData('json')
    const backupId = generateId()

    const response = await fetch(`${this.config.endpoint}/backups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        id: backupId,
        data,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Backup failed: ${response.statusText}`)
    }

    return backupId
  }

    async restoreFromCloud(backupId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Sync not configured')
    }

    const response = await fetch(`${this.config.endpoint}/backups/${backupId}`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Restore failed: ${response.statusText}`)
    }

    const data = await response.json()
    await database.importData(data.data)
  }

  // Utility function to generate ID
  private generateId(): string {
    return crypto.randomUUID()
  }
}

// Singleton instance
export const apiClient = new ApiClient()

// React hook for API
export const useApi = () => {
  return apiClient
}