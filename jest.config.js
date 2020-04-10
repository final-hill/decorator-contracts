module.exports = {
    "reporters": [
      "default",
      ["jest-junit", { "outputDirectory": "./coverage" }]
    ],
    "testEnvironment": "node",
    "transform": { 
      '^.+\\.ts$': 'ts-jest'
    }
}