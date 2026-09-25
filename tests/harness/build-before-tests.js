const { execSync } = require("node:child_process");
const path = require("node:path");

/**
 * Contract tests run the compiled server (dist/index.js), so the project is built before the tests start.
 */
module.exports = () => {
  execSync("npx tsc --project tsconfig.json", { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" });
};
