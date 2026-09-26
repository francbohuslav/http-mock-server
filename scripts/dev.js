const { execFileSync, spawn } = require("node:child_process");
const path = require("node:path");

/**
 * Development mode: TypeScript in watch mode and the server restarted by `node --watch` whenever `dist` changes.
 */
const projectDir = path.join(__dirname, "..");
const tsc = require.resolve("typescript/bin/tsc");

// The server needs compiled files before it can start
execFileSync(process.execPath, [tsc, "--project", "tsconfig.json"], { cwd: projectDir, stdio: "inherit" });

const children = [
  spawn(process.execPath, [tsc, "--watch", "--preserveWatchOutput", "--project", "tsconfig.json"], { cwd: projectDir, stdio: "inherit" }),
  spawn(process.execPath, ["--watch-path=dist", "--watch-preserve-output", "dist/index.js"], { cwd: projectDir, stdio: "inherit" }),
];

function stopAll() {
  for (const child of children) {
    child.kill();
  }
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
for (const child of children) {
  child.on("exit", (code) => {
    stopAll();
    process.exitCode = code ?? 0;
  });
}
