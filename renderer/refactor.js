const fs = require('fs');
const path = require('path');

const files = [
  'src/components/layouts/header.tsx',
  'src/pages/analytics.tsx',
  'src/pages/dashboard.tsx',
  'src/pages/habits.tsx',
  'src/pages/time.tsx'
];

for (const file of files) {
  const filePath = path.join('d:/WEB_DEVELOPMENT/PersonalOS/renderer', file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('electron.execute')) {
    content = content.replace(/electron\.execute/g, 'database.execute');
    
    if (!content.includes('import { database }')) {
        content = "import { database } from '@/lib/database';\n" + content;
    }
    
    fs.writeFileSync(filePath, content);
    console.log('Updated ' + file);
  }
}
