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
    delete (config.listeners.http as Record<string, any>).requests[""];
    server = await MockServerProcess.start(config, FIXTURE_DIR);
    const result = await server.http("/not/configured");
    expect(result.status).toBe(500);
    expect(result.body).toBe("Mock server error: Unknown request");
    const entry = await server.apiJson("/get-last-request/not/configured");
    expect(entry.response.error).toBe("Error: Unknown request");
  });

  // Regression: a response file without the empty separator line used to call process.exit(1)
  it("answers 500 for a response file without an empty line and keeps running", async () => {
    server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
    const result = await server.http("/noSeparator");
    expect(result.status).toBe(500);
    expect(result.body).toMatch(/^Mock server error: /);
    expect(server.isRunning).toBe(true);
  });

  // Regression: a header set to undefined by a processor used to crash the process
  it("skips headers set to undefined by a processor", async () => {
    server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
    const result = await server.http("/withProcessor");
    expect(result.status).toBe(200);
    expect(result.headers.someheader).toBeUndefined();
    expect(result.headers.requesturl).toBe("/withProcessor");
  });

  // Regression: an invalid header value set by a processor used to crash the process
  it("answers 500 for an invalid header value set by a processor", async () => {
    server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
    const result = await server.http("/invalidProcessorHeader");
    expect(result.status).toBe(500);
    expect(result.body).toMatch(/^Mock server error: .*X-Bad/);
    expect((await server.http("/text")).body).toBe("plain text");
  });

  // Regression: headers were split on the last colon, so "Location: http://host:8080" produced an invalid header name
  // and crashed the process
  it("splits a header line on the first colon", async () => {
    server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
    const result = await server.http("/urlHeader");
    expect(result.status).toBe(200);
    expect(result.headers.location).toBe("http://example.com:8080/path");
    expect(result.body).toBe("redirect\n");
  });
});
