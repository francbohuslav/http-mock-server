import { MockServerProcess } from "../harness/mock-server-process";
import { createHttpConfig, FIXTURE_DIR } from "./contract-config";

let server: MockServerProcess;

beforeAll(async () => {
  server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
});

afterAll(async () => {
  await server.stop();
});

describe("response processors", () => {
  it("mutates the reply and sees the request", async () => {
    const result = await server.http("/withProcessor", { headers: { someHeader: "willBePassedToResponse" } });
    expect(result.body).toBe(`{"SOME":"THING"}`);
    expect(result.headers["content-type"]).toBe("text/json");
    expect(result.headers.someheader).toBe("willBePassedToResponse");
    expect(result.headers.requesturl).toBe("/withProcessor");
  });

  it("receives url, headers, body and time of the request", async () => {
    const echoed = await server.http("/echo", { method: "POST", body: "request body", headers: { "X-Custom": "abc" } });
    expect(echoed.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(echoed.body)).toStrictEqual({ url: "/echo", body: "request body", customHeader: "abc", hasTime: true });
  });

  it("can set status code and message", async () => {
    const result = await server.http("/setStatus");
    expect(result.status).toBe(418);
    expect(result.statusText).toBe("I'm a teapot");
    expect(result.body).toBe("teapot");
  });

  it("ignores the return value of the processor", async () => {
    const result = await server.http("/returnsValue");
    expect(result.body).toBe("mutated");
  });

  it("waits for an async processor", async () => {
    const result = await server.http("/withAsyncProcessor");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(190);
    expect(result.body).toBe(`{"SOME":"THING"}`);
  });

  it("runs the processor before the delay", async () => {
    const result = await server.http("/processorAndDelay");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(340);
    expect(result.body).toBe(`{"SOME":"THING"}`);
  });

  it("does not block other requests while an async processor runs", async () => {
    const finished: string[] = [];
    await Promise.all([server.http("/withAsyncProcessor").then(() => finished.push("slow")), server.http("/file").then(() => finished.push("fast"))]);
    expect(finished).toStrictEqual(["fast", "slow"]);
  });

  it("answers 500 when the processor rejects and records the error", async () => {
    const result = await server.http("/withFailingProcessor");
    expect(result.status).toBe(500);
    expect(result.headers["content-type"]).toBe("text/plain");
    expect(result.body).toBe("Mock server error: processor failed");
    const entry = await server.apiJson("/get-last-request/withFailingProcessor");
    expect(entry.response.statusCode).toBe(500);
    expect(entry.response.error).toBe("Error: processor failed");
  });

  it("answers 500 when the processor does not exist", async () => {
    const result = await server.http("/missingProcessor");
    expect(result.status).toBe(500);
    expect(result.body).toMatch(/^Mock server error: ResponseProcessor doesNotExist /);
  });
});
