import { Goal, Task, Habit } from './schema';
export declare class ProgressDatabase {
    private db;
    private encryptionKey;
    private backupInterval;
    private isInitialized;
    constructor();
    private initEncryption;
    private generateNewKey;
    initialize(): Promise<void>;
    private runMigrations;
    private setupBackupSchedule;
    private setupChangeTracking;
    executeQuery<T = any>(query: string, params?: any[]): T[];
    executeTransaction<T = any>(operations: Array<{
        query: string;
        params?: any[];
    }>): T[];
    getData<T = any>(table: string, where?: Record<string, any>): T[];
    insertData<T = any>(table: string, data: Record<string, any>): T;
    updateData<T = any>(table: string, id: string, data: Record<string, any>): T;
    deleteData(table: string, id: string, softDelete?: boolean): boolean;
    createBackup(): Promise<string>;
    private cleanupOldBackups;
    restoreBackup(backupId: string): Promise<boolean>;
    exportData(format: 'json' | 'csv' | 'pdf'): string;
    private convertToCSV;
    private convertToPDF;
    importData(data: string, format: 'json' | 'csv'): Promise<boolean>;
    private parseCSV;
    close(): void;
    getActiveGoals(): Goal[];
    getTodayTasks(): Task[];
    getHabitsForToday(): Habit[];
    updateHabitCompletion(habitId: string, date: string, completed: boolean): void;
    getProgressStats(): unknown;
}
export declare function initDatabase(): Promise<ProgressDatabase>;
export declare function getDatabase(): ProgressDatabase;
export declare function closeDatabase(): void;
//# sourceMappingURL=index.d.ts.map