/**
 * Optimized Renderer Webpack Configuration
 *
 * Since the renderer already uses Vite, this is for reference.
 * For now, renderer is handled by Vite which is more optimized than Webpack.
 *
 * Key optimizations:
 * 1. Code splitting by routes
 * 2. Dynamic imports for heavy components
 * 3. CSS extraction and minification
 * 4. Image optimization
 * 5. Lazy loading of vendor chunks
 */

const path = require('path');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';

function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envVars = {};
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key.startsWith('VITE_') || key === 'NODE_ENV') {
      envVars[key] = value;
    }
  }

  return envVars;
}

const envVars = loadEnv();

module.exports = {
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? false : 'eval-cheap-module-source-map',
  entry: './renderer/src/main.tsx',

  module: {
    rules: [
      // TypeScript/TSX with tree-shaking
      {
        test: /\.tsx?$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
              target: 'es2020',
            },
          },
        },
      },
      // CSS with extraction
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                config: './renderer/postcss.config.js',
              },
            },
          },
        ],
      },
      // Images with optimization
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8KB inline threshold
          },
        },
        generator: {
          filename: 'images/[name].[hash:8][ext]',
        },
      },
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[hash:8][ext]',
        },
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    modules: ['node_modules'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: './renderer/tsconfig.json',
      }),
    ],
    mainFields: ['module', 'main', 'browser'],
  },

  output: {
    publicPath: '',
    // Keep async chunks under main_window so file:// chunk URLs resolve in packaged builds.
    chunkFilename: 'main_window/[name]/index.js',
    clean: true,
  },

  optimization: {
    minimize: isProd,
    usedExports: true,
    sideEffects: false,
    concatenateModules: true,
    // Harden packaged builds: avoid extra runtime/vendor chunk requests from file://.
    runtimeChunk: false,
    splitChunks: false,
  },

  plugins: [
    new webpack.DefinePlugin({
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(
        envVars.VITE_APP_VERSION || 'unknown'
      ),
    }),
  ],

  target: 'web',
  externals: ['better-sqlite3'], // Don't bundle SQLite in renderer

  performance: {
    maxEntrypointSize: 512 * 1024, // 512KB
    maxAssetSize: 512 * 1024,
  },

  infrastructureLogging: {
    level: 'warn',
  },

  stats: {
    modules: false,
    cached: false,
    children: false,
  },
};
