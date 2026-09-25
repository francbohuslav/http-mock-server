import { MockServerProcess } from "../harness/mock-server-process";
import { createHttpConfig, FIXTURE_DIR } from "./contract-config";

/**
 * Every test starts its own server because some scenarios used to crash the process.
 */
let server: MockServerProcess | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe("startup", () => {
  it("does not start the HTTP listener when it is disabled", async () => {
    const config = createHttpConfig();
    config.listeners.http = { ...config.listeners.http, enabled: false };
    server = await MockServerProcess.start(config, FIXTURE_DIR);
    await expect(server.http("/text")).rejects.toThrow();
    expect((await server.api("/get-all-requests/")).status).toBe(200);
  });

  it("skips disabled broker listeners", async () => {
    const config = createHttpConfig();
    config.listeners.kafka = { kafka1: { enabled: false, host: "localhost:1", requests: {}, responses: {} } };
    config.listeners.amqp = { amqp1: { enabled: false, host: "amqp://localhost:1", requests: {}, responses: {} } };
    server = await MockServerProcess.start(config, FIXTURE_DIR);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(server.isRunning).toBe(true);
    expect((await server.http("/text")).body).toBe("plain text");
  });
});

describe("errors", () => {
  it("answers 500 when no rule matches", async () => {
    const config = createHttpConfig();
    delete (config.listeners.http?.requests as Record<string, unknown>)[""];
    server = await MockServerProcess.start(config, FIXTURE_DIR);
    const result = await server.http("/not/configured");
    expect(result.status).toBe(500);
    expect(result.body).toBe("Mock server error: Unknown request");
    const entry = await server.apiJson("/get-last-request/not/configured");
    expect(entry.response.error).toBe("Error: Unknown request");
  });

  // Q1: a response file without the empty separator line used to call process.exit(1)
  it.failing("answers 500 for a response file without an empty line and keeps running", async () => {
    server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
    const result = await server.http("/noSeparator");
    expect(result.status).toBe(500);
    expect(result.body).toMatch(/^Mock server error: /);
    expect(server.isRunning).toBe(true);
  });

  // Q15: headers were split on the last colon, so "Location: http://host:8080" produced an invalid header name
  // and crashed the process
  it.failing("splits a header line on the first colon", async () => {
    server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
    const result = await server.http("/urlHeader");
    expect(result.status).toBe(200);
    expect(result.headers["location"]).toBe("http://example.com:8080/path");
    expect(result.body).toBe("redirect\n");
  });
});
