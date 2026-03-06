const path = require('path');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';

// Load .env file
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

    if (key.startsWith('VITE_')) {
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
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    modules: ['node_modules'],
    plugins: [new TsconfigPathsPlugin({ configFile: './renderer/tsconfig.json' })],
  },
  output: {
    path: path.resolve(__dirname, 'renderer/dist'),
    filename: 'index.js',
    publicPath: './',
  },
  plugins: [
    new webpack.DefinePlugin({
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(envVars.VITE_APP_VERSION || 'unknown'),
    }),
  ],
  target: 'web',
  externals: ['better-sqlite3'],
};
