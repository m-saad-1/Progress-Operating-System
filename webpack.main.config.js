const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? false : 'eval-cheap-module-source-map',

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
    'nodemailer': 'commonjs nodemailer',
  },

  infrastructureLogging: {
    level: 'warn',
  },

  stats: 'errors-warnings',
};
