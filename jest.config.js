module.exports = {
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\.(ts|tsx)$": ["ts-jest"],
  },
  testMatch: ["**/tests/**/*.test.ts"],
  testEnvironment: "node",
  globalSetup: "./tests/harness/build-before-tests.js",
  testTimeout: 20000,
};
