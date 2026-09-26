import { MockServerProcess } from "../harness/mock-server-process";
import { createHttpConfig, FIXTURE_DIR } from "./contract-config";

let server: MockServerProcess;

beforeEach(async () => {
  server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
});

afterEach(async () => {
  await server.stop();
});

describe("hot reload", () => {
  it("re-reads HTTP rules on every request", async () => {
    expect((await server.http("/text")).body).toBe("plain text");
    const config = createHttpConfig();
    (config.listeners.http as Record<string, any>).requests["^/text$"] = "text:changed text";
    server.writeConfig(config);
    expect((await server.http("/text")).body).toBe("changed text");
  });

  it("re-reads response files on every request", async () => {
    expect((await server.http("/reloadable")).body).toBe("first version\n");
    server.writeResponseFile("reloadable.txt", "Content-Type: text/plain\n\nsecond version");
    expect((await server.http("/reloadable")).body).toBe("second version");
  });

  // Regression: HTTP templates were taken from the startup config only
  it("re-reads HTTP templates on every request", async () => {
    expect((await server.http("/textTemplate")).body).toBe("template text");
    const config = createHttpConfig();
    (config.listeners.http as Record<string, any>).responses.textTemplate.content = "text:changed template";
    server.writeConfig(config);
    expect((await server.http("/textTemplate")).body).toBe("changed template");
  });
});
