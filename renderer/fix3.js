const fs = require('fs');

let syncContent = fs.readFileSync('src/lib/sync.ts', 'utf-8');
syncContent = syncContent.split('{ invoke: require("@tauri-apps/api/core").invoke }.onSyncUpdate').join('(() => () => {})');
fs.writeFileSync('src/lib/sync.ts', syncContent);

let dbContent = fs.readFileSync('src/lib/database.ts', 'utf-8');
dbContent = dbContent.split('{ invoke: require("@tauri-apps/api/core").invoke }.').join('invoke(');
dbContent = dbContent.split('return invoke.bind(null, "restore_backup")(backupId);').join('return invoke("restore_backup", { backupId });');
dbContent = dbContent.split('return invoke.bind(null, "list_backups")();').join('return invoke("list_backups");');
fs.writeFileSync('src/lib/database.ts', dbContent);
