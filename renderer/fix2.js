const fs = require('fs');
const cp = require('child_process');

const files = cp.execSync('dir /s /b src\\*.tsx src\\*.ts').toString().split('\r\n').filter(Boolean);
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes('electronAPI')) {
    content = content.replace(/window\.electronAPI/g, '{ invoke: require("@tauri-apps/api/core").invoke }');
    fs.writeFileSync(file, content);
  }
});
