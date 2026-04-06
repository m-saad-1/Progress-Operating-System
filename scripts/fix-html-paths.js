const fs = require('fs');
const path = require('path');

// Fix HTML script paths for production builds
const htmlPath = path.join(__dirname, '..', '.webpack', 'renderer', 'main_window', 'index.html');

if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Replace absolute paths with relative paths
  // Change /main_window/index.js to ./index.js
  html = html.replace(/src="\/main_window\/index\.js"/g, 'src="./index.js"');
  html = html.replace(/src='\/main_window\/index\.js'/g, "src='./index.js'");
  
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[FIX-HTML] Fixed script paths in index.html');
} else {
  console.warn('[FIX-HTML] HTML file not found at:', htmlPath);
}
