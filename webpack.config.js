const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    main: './src/main.ts',
    preload: './src/preload.ts',
  },
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  externals: {
    'electron': 'commonjs electron',
    'sqlite3': 'commonjs sqlite3',
  },
};