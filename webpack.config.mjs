/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

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
      /* eslint-disable @typescript-eslint/naming-convention */
      '.js': ['.js', '.ts'],
      '.mjs': ['.mjs', '.mts']
      /* eslint-enable @typescript-eslint/naming-convention */
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
    new ESLintWebpackPlugin({
      extensions: ['.mts', '.mjs', '.js', '.ts', '.json'],
      exclude: ['node_modules', 'dist', 'coverage'],
      fix: true,
      overrideConfigFile: path.resolve(dirName, '.eslintrc.json'),

      overrideConfig: {
        env: {
          browser: true,
          node: true,
          jest: true,
          es2022: true
        },
        extends: [
          'eslint:recommended',
          'plugin:@typescript-eslint/eslint-recommended'
        ],
        ignorePatterns: [
          'node_modules',
          'dist',
          '.cache',
          'coverage'
        ],
        parser: '@typescript-eslint/parser',
        parserOptions: {
          sourceType: 'module',
          project: [
            './tsconfig.json'
          ]
        },
        plugins: [
          '@typescript-eslint',
          'header'
        ],
        rules: {

        }
      }
    })
  ]
};