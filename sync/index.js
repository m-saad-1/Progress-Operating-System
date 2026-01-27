"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncManager = void 0;
exports.getSyncManager = getSyncManager;
exports.setupSyncManager = setupSyncManager;
const events_1 = require("events");
const electron_1 = require("electron");
const database_1 = require("../database");
class SyncManager extends events_1.EventEmitter {
    config;
    status;
    syncInterval = null;
    constructor() {
        super();
        this.config = {
            enabled: false,
            provider: 'supabase',
            syncInterval: 5,
            encryptionKey: '',
        };
        this.status = {
            isSyncing: false,
            lastSyncTime: null,
        };
        this.loadConfig();
    }
    loadConfig() {
        try {
            const configPath = `${electron_1.app.getPath('userData')}/sync-config.json`;
            const fs = require('fs');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.config = { ...this.config, ...config };
            }
        }
        catch (error) {
            console.error('Failed to load sync config:', error);
        }
    }
    saveConfig() {
        try {
            const configPath = `${electron_1.app.getPath('userData')}/sync-config.json`;
            const fs = require('fs');
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.error('Failed to save sync config:', error);
        }
    }
    async start() {
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
            await this.performSync();
            this.syncInterval = setInterval(() => {
                this.performSync().catch(console.error);
            }, this.config.syncInterval * 60 * 1000);
            this.emit('statusChange', {
                ...this.status,
                lastSyncTime: new Date(),
            });
        }
        catch (error) {
            this.status.isSyncing = false;
            this.status.error = error.message;
            this.emit('error', error);
            this.emit('statusChange', { ...this.status });
            throw error;
        }
    }
    async stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.status.isSyncing = false;
        this.emit('statusChange', { ...this.status });
    }
    async performSync() {
        if (!this.config.enabled) {
            return;
        }
        this.status.isSyncing = true;
        this.status.progress = 0;
        this.emit('statusChange', { ...this.status });
        try {
            const db = (0, database_1.getDatabase)();
            this.status.progress = 10;
            this.emit('statusChange', { ...this.status });
            const pendingChanges = await this.getPendingChanges();
            if (pendingChanges.length === 0) {
                await this.checkRemoteChanges();
                this.completeSync();
                return;
            }
            this.status.progress = 30;
            this.emit('statusChange', { ...this.status });
            const encryptedChanges = this.encryptChanges(pendingChanges);
            await this.uploadChanges(encryptedChanges);
            this.status.progress = 60;
            this.emit('statusChange', { ...this.status });
            const remoteChanges = await this.downloadChanges();
            if (remoteChanges.length > 0) {
                const decryptedRemote = this.decryptChanges(remoteChanges);
                await this.applyRemoteChanges(decryptedRemote);
            }
            this.status.progress = 90;
            this.emit('statusChange', { ...this.status });
            await this.markAsSynced(pendingChanges);
            this.completeSync();
        }
        catch (error) {
            this.status.isSyncing = false;
            this.status.error = error.message;
            this.emit('error', error);
            this.emit('statusChange', { ...this.status });
            throw error;
        }
    }
    completeSync() {
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
    async getPendingChanges() {
        const db = (0, database_1.getDatabase)();
        return db.executeQuery(`
      SELECT * FROM sync_state 
      WHERE pending = TRUE
      ORDER BY last_synced ASC
    `);
    }
    encryptChanges(changes) {
        return changes.map(change => ({
            ...change,
            data: this.encryptData(JSON.stringify(change.data)),
        }));
    }
    decryptChanges(changes) {
        return changes.map(change => ({
            ...change,
            data: JSON.parse(this.decryptData(change.data)),
        }));
    }
    encryptData(data) {
        return Buffer.from(data).toString('base64');
    }
    decryptData(encrypted) {
        return Buffer.from(encrypted, 'base64').toString('utf8');
    }
    async uploadChanges(changes) {
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
    async uploadToSupabase(changes) {
        if (!this.config.endpoint || !this.config.apiKey) {
            throw new Error('Supabase configuration missing');
        }
        console.log('Uploading to Supabase:', changes.length, 'changes');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    async uploadToFirebase(changes) {
        if (!this.config.endpoint || !this.config.apiKey) {
            throw new Error('Firebase configuration missing');
        }
        console.log('Uploading to Firebase:', changes.length, 'changes');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    async uploadToCustom(changes) {
        if (!this.config.endpoint) {
            throw new Error('Custom endpoint missing');
        }
        console.log('Uploading to custom endpoint:', changes.length, 'changes');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    async downloadChanges() {
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
    async downloadFromSupabase() {
        console.log('Downloading from Supabase');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return [];
    }
    async downloadFromFirebase() {
        console.log('Downloading from Firebase');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return [];
    }
    async downloadFromCustom() {
        console.log('Downloading from custom endpoint');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return [];
    }
    async checkRemoteChanges() {
        console.log('Checking for remote changes');
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    async applyRemoteChanges(changes) {
        const db = (0, database_1.getDatabase)();
        for (const change of changes) {
            try {
                await this.applyChange(change);
            }
            catch (error) {
                console.error('Failed to apply change:', error);
            }
        }
    }
    async applyChange(change) {
        const db = (0, database_1.getDatabase)();
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
    async markAsSynced(changes) {
        const db = (0, database_1.getDatabase)();
        for (const change of changes) {
            await db.executeQuery(`
        UPDATE sync_state 
        SET pending = FALSE, last_synced = ?, sync_version = sync_version + 1
        WHERE id = ?
      `, [new Date().toISOString(), change.id]);
        }
    }
    getStatus() {
        return { ...this.status };
    }
    getConfig() {
        return { ...this.config };
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
        this.saveConfig();
        this.emit('configChange', this.config);
    }
    enable() {
        this.config.enabled = true;
        this.saveConfig();
        this.emit('configChange', this.config);
    }
    disable() {
        this.config.enabled = false;
        this.saveConfig();
        this.emit('configChange', this.config);
    }
    isEnabled() {
        return this.config.enabled;
    }
    async testConnection() {
        try {
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
        }
        catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
    async testSupabaseConnection() {
        return true;
    }
    async testFirebaseConnection() {
        return true;
    }
    async testCustomConnection() {
        return true;
    }
}
exports.SyncManager = SyncManager;
let syncManager = null;
function getSyncManager() {
    if (!syncManager) {
        syncManager = new SyncManager();
    }
    return syncManager;
}
function setupSyncManager() {
    const manager = getSyncManager();
    if (manager.isEnabled()) {
        manager.start().catch(console.error);
    }
}
//# sourceMappingURL=index.js.map