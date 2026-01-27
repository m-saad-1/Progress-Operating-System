module.exports = {
  packagerConfig: {
    asar: true
  },

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'personalos'
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
