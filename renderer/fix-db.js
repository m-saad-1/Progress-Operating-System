const fs = require('fs');

let content = fs.readFileSync('src/lib/database.ts', 'utf-8');

// Add import
if (!content.includes('@tauri-apps/api/core')) {
  content = "import { invoke } from '@tauri-apps/api/core';\n" + content;
}

// Global mock object to replace window.electronAPI
const mockObj = `({
  invoke: (...args) => {
    try {
      return invoke(...args);
    } catch (e) {
      console.warn('Tauri invoke failed (mocking response):', e);
      return { success: false, error: e.message };
    }
  },
  executeQuery: (q, p) => invoke('execute_query', { query: q, params: p || [] }).catch(e => ({ success: false, error: e.message })),
  executeTransaction: (ops) => invoke('execute_transaction', { operations: ops }).catch(e => ({ success: false, error: e.message })),
  createBackup: () => invoke('create_backup').catch(e => ({ success: false, error: e.message })),
  restoreBackup: (id) => invoke('restore_backup', { backupId: id }).catch(e => ({ success: false, error: e.message })),
  listBackups: () => invoke('list_backups').catch(e => ({ success: false, error: e.message })),
})`;

content = content.replace(/window\.electronAPI/g, mockObj);

fs.writeFileSync('src/lib/database.ts', content);
