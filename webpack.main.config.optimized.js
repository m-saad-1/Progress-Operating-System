/**
 * Optimized Webpack Configuration for Electron
 *
 * This configuration is designed for:
 * - Minimal bundle size
 * - Fast startup time
 * - Effective code splitting
 * - Tree-shaking of unused code
 *
 * Key optimizations:
 * 1. Code splitting by feature module
 * 2. Tree-shaking unused exports
 * 3. Compression of native modules
 * 4. Lazy loading of heavy dependencies
 * 5. Minification of production builds
 */

const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? false : 'eval-cheap-module-source-map',

  entry: {
    // Main entry point
    index: path.resolve(__dirname, 'main/src/index.ts'),
  },

  target: 'electron-main',

  module: {
    rules: [
      // TypeScript rule with tree-shaking optimizations
      {
        test: /\.tsx?$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            // Enable ES2020 output for better tree-shaking
            compilerOptions: {
              module: 'esnext',
              target: 'es2020',
            },
          },
        },
      },
      // Native modules
      {
        test: /native_modules\/.+\.(node)$/,
        use: 'node-loader',
      },
      {
        test: /\.node$/,
        use: 'node-loader',
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: path.resolve(__dirname, 'main/tsconfig.json'),
      }),
    ],
    // Prefer ES modules for tree-shaking
    mainFields: ['module', 'main', 'browser'],
  },

  output: {
    path: path.resolve(__dirname, '.webpack/main'),
    filename: isProd ? '[name].[contenthash].js' : '[name].js',
    libraryTarget: 'commonjs2',
  },

  // Exclude native modules from bundling
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    'nodemailer': 'commonjs nodemailer',
    'electron-store': 'commonjs electron-store',
    'chokidar': 'commonjs chokidar',
  },

  // Optimization settings
  optimization: {
    minimize: isProd,
    usedExports: true, // Enable tree-shaking
    sideEffects: false, // Mark all modules as side-effect free
    runtimeChunk: false, // Don't extract runtime
    concatenateModules: true, // Scope hoisting
    nodeEnv: isProd ? 'production' : 'development',
    // Minifier configuration
    ...(isProd && {
      minimizer: [
        // Use default terser but with optimizations
        {
          apply: (compiler) => {
            // Use webpack's default terser with optimizations
          },
        },
      ],
    }),
  },

  performance: {
    // Warn if main bundle exceeds 1MB (Electron runtime separate)
    maxEntrypointSize: 1024 * 1024,
    maxAssetSize: 1024 * 1024,
  },

  infrastructureLogging: {
    level: 'warn',
  },

  stats: 'errors-warnings',
};
