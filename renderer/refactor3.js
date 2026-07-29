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
    if (content.includes('lib/electron')) {
        content = content.replace(/lib\/electron/g, 'lib/tauri');
        fs.writeFileSync(file, content);
        console.log('Fixed imports in ' + file);
    }
}
