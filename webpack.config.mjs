import path from 'path';
import url from 'url';
import ESLintWebpackPlugin from 'eslint-webpack-plugin';

const fileName = url.fileURLToPath(import.meta.url),
  dirName = path.dirname(fileName);

export default {
  entry: './src/index.mts',
  devtool: 'source-map',
  mode: 'production',
  experiments: {
    outputModule: true
  },
  module: {
    rules: [
      {
        test: /\.mts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.mts', '.mjs', '.js', '.ts', '.json'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
      '.mjs': ['.mjs', '.mts']
    }
  },
  output: {
    clean: true,
    library: {
      type: 'module'
    },
    module: true,
    filename: 'index.mjs',
    path: path.resolve(dirName, 'dist'),
  },
  plugins: [
    // Lint during the build, but never rewrite source. A build that silently
    // fixes files makes the working tree disagree with what was committed and
    // masks findings that should fail the pipeline. With `fix` off, a violation
    // fails the build instead of being corrected quietly.
    new ESLintWebpackPlugin({
      extensions: ['.mts', '.mjs', '.js', '.ts', '.json'],
      exclude: ['node_modules', 'dist', 'coverage'],
      fix: false
    })
  ]
};