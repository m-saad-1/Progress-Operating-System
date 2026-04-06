module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Progress OS',
    appBundleId: 'com.progressos.app',
    icon: './build/POS-ICON.ico',
    extraResource: [
      './build/POS-ICON.ico',
      './build/icon.png',
    ],
    asarUnpack: [
      '**/node_modules/better-sqlite3/**/*',
    ],
  },

  hooks: {
    packageAfterCopy: async (config, buildPath) => {
      // Fix HTML script paths after webpack build
      const path = require('path');
      const fs = require('fs');
      
      // Find all HTML files in buildPath
      const findHtmlFiles = (dir) => {
        const files = [];
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            files.push(...findHtmlFiles(fullPath));
          } else if (item.name.endsWith('.html')) {
            files.push(fullPath);
          }
        }
        return files;
      };
      
      const htmlFiles = findHtmlFiles(buildPath);
      const htmlPath = htmlFiles.find(f => f.includes('main_window') && f.endsWith('index.html'));
      
      if (htmlPath && fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // Fix absolute paths: /main_window/index.js -> ./index.js
        html = html.replace(/src="\/main_window\/index\.js"/g, 'src="./index.js"');
        html = html.replace(/src='\/main_window\/index\.js'/g, "src='./index.js'");
        // Fix relative paths: main_window/index.js -> ./index.js
        html = html.replace(/src="main_window\/index\.js"/g, 'src="./index.js"');
        html = html.replace(/src='main_window\/index\.js'/g, "src='./index.js'");
        
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log('[BUILD] Fixed HTML script paths for production build');
      }
    },
  },

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'progress-os',
        authors: 'Progress OS',
        exe: 'Progress OS.exe',
        setupExe: 'Progress OS Setup.exe',
        setupMsi: 'Progress OS Setup.msi',
        iconUrl: 'file:///./build/POS-ICON.ico',
        icon: './build/POS-ICON.ico'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        devServer: {
          liveReload: false,
          hot: false,
          client: false,
        },
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './renderer/index.html',
              js: './renderer/src/main.tsx',
              name: 'main_window',
              preload: {
                js: './main/src/preload.ts'
              }
            }
          ]
        }
      }
    }
  ]
};
