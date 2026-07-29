const fs = require('fs');
const files = [
  'd:/WEB_DEVELOPMENT/PersonalOS/renderer/src/components/layouts/header.tsx',
  'd:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/analytics.tsx',
  'd:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/dashboard.tsx',
  'd:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/habits.tsx',
  'd:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/time.tsx'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ database \} from '@\/lib\/database';/g, '');
  content = content.replace(/import \{ database \} from "\@\/lib\/database";/g, '');
  content = "import { database } from '@/lib/database';\n" + content;
  fs.writeFileSync(file, content);
}
