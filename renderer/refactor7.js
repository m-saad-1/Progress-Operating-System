const fs = require('fs');

// Fix backup.tsx
let backupContent = fs.readFileSync('d:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/backup.tsx', 'utf8');
backupContent = "import { useState } from 'react';\n" + backupContent;
fs.writeFileSync('d:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/backup.tsx', backupContent);

// Fix archive.tsx
let archiveContent = fs.readFileSync('d:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/archive.tsx', 'utf8');
archiveContent = archiveContent.replace(/setSelectedItem\(item\)/g, "setSelectedItem(item as any)");
archiveContent = archiveContent.replace(/task=\{selectedItem\}/g, "task={selectedItem as any}");
archiveContent = archiveContent.replace(/task=\{item\}/g, "task={item as any}");
fs.writeFileSync('d:/WEB_DEVELOPMENT/PersonalOS/renderer/src/pages/archive.tsx', archiveContent);

