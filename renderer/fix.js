const fs = require('fs');
let content = fs.readFileSync('src/lib/database.ts', 'utf-8');
content = content.replace(/window\.electronAPI/g, 'window.__TAURI_INTERNALS__');
content = content.replace(/window\.__TAURI_INTERNALS__\.invoke/g, 'invoke');
content = content.replace(/window\.__TAURI_INTERNALS__\.restoreBackup/g, 'invoke.bind(null, "restore_backup")');
content = content.replace(/window\.__TAURI_INTERNALS__\.listBackups/g, 'invoke.bind(null, "list_backups")');
fs.writeFileSync('src/lib/database.ts', content);
