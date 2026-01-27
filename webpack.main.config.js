const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: 'development',

  entry: path.resolve(__dirname, 'main/src/index.ts'),

  target: 'electron-main',

  module: {
    rules: require('./webpack.rules'),
  },

  resolve: {
    extensions: ['.ts', '.js', '.json'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: path.resolve(__dirname, 'main/tsconfig.json'),
      }),
    ],
  },

  output: {
    path: path.resolve(__dirname, '.webpack/main'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },

  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
  },

  infrastructureLogging: {
    level: 'warn',
  },

  stats: 'errors-warnings',
};
