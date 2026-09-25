import path from "path";
import { MockServerApp } from "./app";

const projectDir = path.join(__dirname, "..");

const app = new MockServerApp({
  rootDir: process.env.HTTP_MOCK_SERVER_ROOT || projectDir,
  historyPagePath: path.join(projectDir, "request-history.html"),
});

app.start().catch((error) => {
  console.error(error);
  process.exit(1);
});
