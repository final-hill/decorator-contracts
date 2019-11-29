module.exports = {
    "preset": "ts-jest",
    "reporters": [
      "default",
      ["jest-junit", { "outputDirectory": "./coverage" }]
    ],
    "testEnvironment": "node"
}