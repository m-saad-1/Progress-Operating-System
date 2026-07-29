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
  
  // Replace database.executeQuery<Type[]> with database.executeQuery<Type>
  content = content.replace(/database\.executeQuery<([A-Za-z0-9_]+)\[\]>/g, 'database.executeQuery<>');
  
  fs.writeFileSync(filePath, content);
}
