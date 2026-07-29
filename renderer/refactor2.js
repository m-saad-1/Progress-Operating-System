const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walkDir(fullPath));
        } else { 
            if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = walkDir('d:/WEB_DEVELOPMENT/PersonalOS/renderer/src');
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('useElectron') || content.includes('use-electron')) {
        content = content.replace(/useElectron/g, 'useTauri');
        content = content.replace(/use-electron/g, 'use-tauri');
        content = content.replace(/const electron =/g, 'const tauri =');
        content = content.replace(/electron\./g, 'tauri.');
        fs.writeFileSync(file, content);
        console.log('Refactored ' + file);
    }
}
