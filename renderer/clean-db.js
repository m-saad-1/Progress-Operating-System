const fs = require('fs');
let content = fs.readFileSync('src/lib/database.ts', 'utf-8');

// Completely remove __tauri_electron_mock block
content = content.replace(/const __tauri_electron_mock = \{[\s\S]*?\};\n/m, '');

// Clean up backup methods
content = content.replace(/async createBackup\(\): Promise<any> \{[\s\S]*?__tauri_electron_mock\.createBackup\(\);\s*\}/,
`async createBackup(): Promise<any> {
    return invoke('create_backup').catch(e => ({ success: false, error: e.message || String(e) }));
  }`);

content = content.replace(/async restoreBackup\(backupId: string\): Promise<boolean> \{[\s\S]*?__tauri_electron_mock\.restoreBackup\(backupId\);\s*\}/,
`async restoreBackup(backupId: string): Promise<boolean> {
    return invoke('restore_backup', { backupId }).catch(e => false);
  }`);

content = content.replace(/async listBackups\(\): Promise<Backup\[\]> \{[\s\S]*?__tauri_electron_mock\.listBackups\(\);\s*\}/,
`async listBackups(): Promise<Backup[]> {
    return invoke('list_backups').catch(e => []);
  }`);

// Clean up duplicate backup methods (caused by my previous bad regex)
content = content.replace(/async createBackup\(\): Promise<any> \{\s*return invoke\('create_backup'\)[^}]+\}\s*return __tauri_electron_mock\.createBackup\(\);\s*\}/, 
`async createBackup(): Promise<any> {
    return invoke('create_backup').catch(e => ({ success: false, error: e.message || String(e) }));
  }`);

content = content.replace(/async restoreBackup\(backupId: string\): Promise<boolean> \{\s*return invoke\('restore_backup'[^}]+\}\s*return __tauri_electron_mock\.restoreBackup\(backupId\);\s*\}/,
`async restoreBackup(backupId: string): Promise<boolean> {
    return invoke('restore_backup', { backupId }).catch(e => false);
  }`);

content = content.replace(/async listBackups\(\): Promise<Backup\[\]> \{\s*return invoke\('list_backups'[^}]+\}\s*return __tauri_electron_mock\.listBackups\(\);\s*\}/,
`async listBackups(): Promise<Backup[]> {
    return invoke('list_backups').catch(e => []);
  }`);

fs.writeFileSync('src/lib/database.ts', content);
