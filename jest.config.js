module.exports = {
    "reporters": [
      "default",
      ["jest-junit", { "outputDirectory": "./coverage" }]
    ],
    "testEnvironment": "node",
    "transform": { 
      '^.+\\.ts$': 'ts-jest',
      '^.+\\.js$': 'babel-jest',
    },
    // https://github.com/facebook/jest/issues/8973#issuecomment-565116176
    "globals": {
      "ts-jest": {
        "babelConfig": '.babelrc'
      },
      "babel-jest": {
        "babelConfig": '.babelrc'
      }
    }
}