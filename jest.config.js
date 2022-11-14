module.exports = {
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest"],
  },
  testMatch: ["**/tests/**/*.test.ts"],
  testEnvironment: "node",
};
