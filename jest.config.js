module.exports = {
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tests/tsconfig.json" }],
  },
  testMatch: ["**/tests/**/*.test.ts"],
  testEnvironment: "node",
  globalSetup: "./tests/harness/build-before-tests.js",
  testTimeout: 20000,
};
