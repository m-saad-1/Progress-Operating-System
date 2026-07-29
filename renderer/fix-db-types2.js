const fs = require('fs');
let content = fs.readFileSync('src/lib/database.ts', 'utf-8');

// Fix Task Progress
content = content.replace(/progress: import\("@\/types"\)\.TaskProgress \| number;/g, 'progress: import("@/types").TaskProgress;');

fs.writeFileSync('src/lib/database.ts', content);
