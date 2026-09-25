import { MockServerProcess } from "../harness/mock-server-process";
import { createHttpConfig, FIXTURE_DIR, ISO_TIME } from "./contract-config";

let server: MockServerProcess;

beforeAll(async () => {
  server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
});

afterAll(async () => {
  await server.stop();
});

beforeEach(async () => {
  await server.api("/clear-history/");
});

describe("History API", () => {
  it("records HTTP requests grouped by URL", async () => {
    await server.http("/text", { method: "POST", body: "hello", headers: { "X-Test": "1" } });
    const history = await server.apiJson("/get-all-requests/");
    expect(Object.keys(history)).toStrictEqual(["/text"]);
    expect(history["/text"]).toHaveLength(1);
    const entry = history["/text"][0];
    expect(Object.keys(entry)).toStrictEqual(["type", "endpoint", "request", "response"]);
    expect(entry.type).toBe("http");
    expect(entry.endpoint).toBe("/text");
    expect(entry.request.time).toMatch(ISO_TIME);
    expect(entry.request.url).toBe("/text");
    expect(entry.request.body).toBe("hello");
    expect(entry.request.headers["x-test"]).toBe("1");
    expect(entry.response).toStrictEqual({
      time: expect.stringMatching(ISO_TIME),
      headers: { "Content-Type": "text/plain" },
      body: "plain text",
    });
  });

  it("records status and headers of file replies", async () => {
    await server.http("/statusWithText");
    const entry = await server.apiJson("/get-last-request/statusWithText");
    expect(entry.response).toStrictEqual({
      time: expect.stringMatching(ISO_TIME),
      headers: { "Content-Type": "text/plain" },
      body: "status with text\n",
      statusCode: 201,
      statusMessage: "Created",
    });
  });

  it("keeps the query string in the endpoint key", async () => {
    await server.http("/query?a=1");
    const history = await server.apiJson("/get-all-requests/");
    expect(Object.keys(history)).toStrictEqual(["/query?a=1"]);
    const entry = await server.apiJson("/get-last-request/query?a=1");
    expect(entry.endpoint).toBe("/query?a=1");
  });

  it("returns the last request of an endpoint", async () => {
    await server.http("/text", { method: "POST", body: "first" });
    await server.http("/text", { method: "POST", body: "second" });
    const result = await server.api("/get-last-request/text");
    expect(result.headers["content-type"]).toBe("application/json");
    expect(result.headers["server"]).toBe("HttpMockServer");
    expect(JSON.parse(result.body).request.body).toBe("second");
    expect((await server.apiJson("/get-all-requests/"))["/text"]).toHaveLength(2);
  });

  it("returns an empty body for an unknown endpoint", async () => {
    const result = await server.api("/get-last-request/nothing");
    expect(result.status).toBe(200);
    expect(result.body).toBe("");
  });

  it("returns pretty printed JSON", async () => {
    await server.http("/text");
    const result = await server.api("/get-all-requests/");
    expect(result.body).toBe(JSON.stringify(JSON.parse(result.body), null, 2));
  });

  it("clears the history", async () => {
    await server.http("/text");
    const result = await server.api("/clear-history/");
    expect(result.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(result.body)).toBe("Memory cleared");
    expect(await server.apiJson("/get-all-requests/")).toStrictEqual({});
  });

  it.each(["/", "/anything", "/get-all-requests"])("serves the history web page on %s", async (url) => {
    const result = await server.api(url);
    expect(result.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(result.body).toContain("<title>Request History</title>");
  });

  // Q4: the "return everything" branch for an empty endpoint was unreachable
  it.failing("returns the whole history for an empty endpoint", async () => {
    await server.http("/text");
    const history = await server.apiJson("/get-last-request/");
    expect(Object.keys(history)).toStrictEqual(["/text"]);
  });
});
