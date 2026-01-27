module.exports = [
  // Add support for native Node.js modules
  {
    test: /native_modules\/.+\.(node)$/,
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
