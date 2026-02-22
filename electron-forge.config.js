module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Progress OS',
    appBundleId: 'com.progressos.app',
    icon: './build/POS-ICON'
  },

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Progress OS',
        authors: 'Progress OS',
        exe: 'Progress OS.exe',
        setupExe: 'Progress OS Setup.exe',
        setupMsi: 'Progress OS Setup.msi'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],

  plugins: [
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
