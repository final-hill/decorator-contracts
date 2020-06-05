# Contributing

Contributions are not currently being accepted.

The license for this library is AGPL-3.0-only and [exceptions may be sold](https://www.fsf.org/blogs/rms/selling-exceptions)
for commercial and other private use. A CLA is also not currently defined.

When these issues are resolved and more formalized contributions will then be accepted with the 
appropriate caveats.

## Building and Editing

## Getting Started

- Clone the repository

```batch
git clone --depth=1 ...
```

- Install dependencies

```batch
cd <project_name>
npm install
```

- Build

```batch
npm run build
```

## Project Structure

| Name              | Description                                                                                                   |
|:------------------|:--------------------------------------------------------------------------------------------------------------|
| .cache            | Cache directory generated by [Parcel](https://parceljs.org/)                                                  |
| .vscode           | Settings for VS Code                                                                                          |
| azure             | Build pipeline definitions used by Azure Devops                                                               |
| dist              | Contains the compiled output of the build                                                                     |
| docs              | Library documentation                                                                                         |
| node_modules      | node package dependencies                                                                                     |
| src               | Contains the source code that will be compiled to the `dist` dir                                              |
| .editorconfig     | Config settings for [EditorConfig](https://editorconfig.org/) IDE code style checking                         |
| .gitignore        | Specifies files untracked by version control                                                                  |
| .npmrc            | npm config settings                                                                                           |
| LICENSE           | GNU General Public License v2.0 only                                                                          |
| package-lock.json | Autogenerated [meta-manifest](https://docs.npmjs.com/files/package-lock.json) of package.json                 |
| package.json      | [Node Package configuration](https://docs.npmjs.com/files/package.json) settings with related build scripts   |
| README.md         | The current file. A high level overview of the library                                                        |
| tsconfig.json     | Config settings for compiling TypeScript code                                                                 |
| tslint.json       | Config settings for TSLint code style checking                                                                |

## Build and Test

To build and test this library locally you will need the following:

- [VS Code](https://code.visualstudio.com/)

  - Install the recommended extensions

- A [active](https://github.com/nodejs/Release) version of [Node.js](https://nodejs.org/en/)
  - With a corresponding [npm installation](https://www.npmjs.com/get-npm)

| Npm Script    | Description |
|:--------------|:------------|
| `build`       | Performs a full build of the library including type generation and linting. Outputs to the `dist` folder |
| `build-nofix` | Perfoms the sames steps as `build` except that `lint-nofix` will be executed.                            |
| `build-types` | Generates type definitions for the library in the `dist` folder                                          |
| `clean`       | deletes the `dist` folder                                                                                |
| `clean-full`  | deletes the `dist`, `node_modules`,  and `.cache` folders                                                |
| `debug`       | Starts debugger                                                                                          |
| `lint`        | Performs linting and type checking of the library                                                        |
| `lint-nofix`  | Performs linting but will not autofix problems.                                                          |
| `test`        | Executes unit tests                                                                                      |
| `type-check`  | Performs type checking                                                                                   |

## Dependencies

Dependencies are managed through `package.json`. There are no runtime dependencies.
The development dependencies are as follows:

| Package                                   | Description                                   | License      |
|:------------------------------------------|:----------------------------------------------|--------------|
| `@types/jest`                             | Type definitions for `ts-jest` support        | MIT          |
| `@types/node`                             | Type definitions for node. (used for build)   | MIT          |
| `@typescript-eslint/eslint-plugin`        | Type definitions for ESLint                   | MIT          |
| `@typescript-eslint/eslint-plugin-tslint` | Type definitions for ESLint extension         | MIT          |
| `@typescript-eslint/parser`               | Type definitions for ESLint parser            | BSD-2-Clause |
| `eslint`                                  | ECMAScript linting library                    | MIT          |
| `eslint-plugin-header`                    | ESLint extension for linting file headers     | MIT          |
| `eslint-plugin-import`                    | ESLint extension for linting imports          | MIT          |
| `jest`                                    | JavaScript Unit testing library               | MIT          |
| `jest-junit`                              | Jest extension for JUnit reporting            | Apache-2.0   |
| `rimraf`                                  | Cross platform lib for deleting files/folders | ISC          |
| `ts-jest`                                 | TypeScript support for `jest`                 | MIT          |
| `ts-loader`                               | TypeScript loader for Webpack                 | MIT          |
| `typescript`                              | TypeScript compiler                           | Apache-2.0   |
| `webpack`                                 | Module bundler                                | MIT          |
| `webpack-cli`                             | Command line library for WebPack              | MIT          |

If you're using Windows and a newer version of NodeJS then you may additionally
need to run the following command due to a transitive dependency on [node-gyp](https://github.com/nodejs/node-gyp):

`npm install -g windows-build-tools`