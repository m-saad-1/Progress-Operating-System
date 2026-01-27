const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: 'development',
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
  target: 'web',
  externals: ['better-sqlite3'],
};
