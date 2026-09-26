import path from "node:path";
import { MockServerApp } from "./app";

const SHUTDOWN_TIMEOUT_MS = 5000;

const projectDir = path.join(__dirname, "..");

const app = new MockServerApp({
  rootDir: process.env.HTTP_MOCK_SERVER_ROOT || projectDir,
  historyPagePath: path.join(projectDir, "request-history.html"),
});

app.start().catch((error) => {
  console.error(error);
  process.exit(1);
});

let shuttingDown = false;

/**
 * The first signal stops the server gracefully (e.g. `docker stop`), a second one or a timeout exits immediately.
 */
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`${signal} received, stopping...`);
  setTimeout(() => {
    console.error(`Server did not stop in ${SHUTDOWN_TIMEOUT_MS} ms, exiting`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  app.stop().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
