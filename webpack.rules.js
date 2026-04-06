const isProd = process.env.NODE_ENV === 'production';
// In development, avoid reusing a single native asset path that can remain file-locked on Windows.
const nativeAssetBase = isProd
  ? 'native_modules'
  : `native_modules_dev_${process.pid}_${Date.now()}`;

module.exports = [
  // Relocate dynamically required assets/native modules into .webpack output
  {
    test: /\.(m?js|node)$/,
    parser: {
      amd: false,
    },
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: nativeAssetBase,
      },
    },
  },
  // Add support for native Node.js modules
  {
    test: /native_modules[^/\\]*[\\/].+\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  // TypeScript rule
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
  // CSS rule
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
  // Images rule
  {
    test: /\.(png|jpe?g|gif|svg)$/i,
    use: [
      {
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]',
        },
      },
    ],
  },
];
