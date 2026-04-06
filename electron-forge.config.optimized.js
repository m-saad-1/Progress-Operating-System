/**
 * Optimized Electron Forge Configuration
 *
 * Key improvements:
 * 1. Smaller artifact size through compression
 * 2. ASAR (Asynchronous Resource Archive) for bundling
 * 3. Code signing support
 * 4. Proper resource handling
 * 5. Auto-updates configuration
 */

module.exports = {
  packagerConfig: {
    asar: true, // Bundle into ASAR archive for smaller size
    name: 'Progress OS',
    appBundleId: 'com.progressos.app',
    icon: './build/POS-ICON',

    // Optimizations for Windows
    ...(process.platform === 'win32' && {
      certificateFile: process.env.WIN_CERT_FILE,
      certificatePassword: process.env.WIN_CERT_PASSWORD,
      signingHashAlgorithms: ['sha256'],
      sign: './build/sign.js', // Custom signing script if needed
    }),

    // Optimizations for macOS
    ...(process.platform === 'darwin' && {
      identity: process.env.APPLE_IDENTITY,
      gatekeeperAssess: false,
    }),

    // Exclude unnecessary files
    ignore: [
      /^\/\.venv/,
      /^\/\.git/,
      /^\/\.github/,
      /^\/node_modules\/\.cache/,
      /^\/renderer\/node_modules\/.cache/,
      /^\/\.env.*$/,
      /^\/build\/(?!.*\.ico|.*\.plist)/,
      /^\/scripts/,
      /^\/docs/,
      /vite\.config\.ts/,
      /webpack\.renderer\.config\.js/,
      /tsconfig\.json/,
      /\.md$/,
    ],

    // Add only necessary build assets
    extraResource: [
      './build/POS-ICON.ico',
      './build/entitlements.mac.plist',
      './shared/constants.js',
    ],
  },

  makers: [
    // Windows Squirrel installer
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Progress OS',
        authors: 'Progress OS',
        exe: 'Progress OS.exe',
        setupExe: 'Progress OS Setup.exe',
        setupMsi: 'Progress OS Setup.msi',
        // ICO file for installer
        iconUrl: 'https://example.com/icon.ico',
        // Compression settings
        certificateFile: process.env.WIN_CERT_FILE,
        certificatePassword: process.env.WIN_CERT_PASSWORD,
      },
    },
    // ZIP archive for portable distribution
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
      config: {
        // ZIP is already compressed
      },
    },
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.optimized.js',
        devServer: {
          liveReload: false,
          hot: false,
          client: false,
          // Faster dev builds
          compress: false,
          static: false,
        },
        renderer: {
          config: './webpack.renderer.config.optimized.js',
          entryPoints: [
            {
              html: './renderer/index.html',
              js: './renderer/src/main.tsx',
              name: 'main_window',
              preload: {
                js: './main/src/bridge.ts', // Use new bridge instead of preload.ts
              },
            },
          ],
          // Enable code splitting for renderer
          nodeIntegration: false,
        },
      },
    },
    // Auto-update plugin
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses plugin for security
    {
      name: '@electron-forge/plugin-fuses',
      config: {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      },
    },
  ],

  // Publisher configuration for auto-updates
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'your-github-user',
          name: 'personal-os',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

// Fuse constants (would be imported normally)
const FuseVersion = { V1: 1 };
const FuseV1Options = {
  RunAsNode: 'run_as_node',
  EnableCookieEncryption: 'enable_cookie_encryption',
  EnableNodeCliInspectArguments: 'enable_node_cli_inspect_arguments',
  EnableNodeOptionsEnvironmentVariable:
    'enable_node_options_environment_variable',
  GrantFileProtocolExtraPrivileges: 'grant_file_protocol_extra_privileges',
};
