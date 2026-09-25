import { MockServerProcess } from "../harness/mock-server-process";
import { createHttpConfig, FIXTURE_DIR } from "./contract-config";

let server: MockServerProcess;

beforeAll(async () => {
  server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
});

afterAll(async () => {
  await server.stop();
});

describe("HTTP routing", () => {
  it("uses the first matching regex in key order", async () => {
    const result = await server.http("/order/second");
    expect(result.body).toBe("first");
  });

  it("falls back to the catch-all empty key", async () => {
    const result = await server.http("/not/configured");
    expect(result.status).toBe(200);
    expect(result.body).toBe("unknown request");
  });

  it("matches the URL including the query string", async () => {
    const result = await server.http("/query?a=1");
    expect(result.body).toBe("query matched");
  });

  it("routes all HTTP methods the same way", async () => {
    const result = await server.http("/text", { method: "POST", body: "anything" });
    expect(result.body).toBe("plain text");
  });
});

describe("HTTP replies", () => {
  it("returns inline text with default headers", async () => {
    const result = await server.http("/text");
    expect(result.status).toBe(200);
    expect(result.body).toBe("plain text");
    expect(result.headers["content-type"]).toBe("text/plain");
    expect(result.headers["server"]).toBe("HttpMockServer");
  });

  it("returns a response file with its headers", async () => {
    const result = await server.http("/file");
    expect(result.status).toBe(200);
    expect(result.body).toBe(`{"some":"thing"}`);
    expect(result.headers["content-type"]).toBe("text/json");
    expect(result.headers["server"]).toBe("HttpMockServer");
  });

  it("keeps the default text/plain content type when the file does not define it", async () => {
    const result = await server.http("/noContentType");
    expect(result.headers["content-type"]).toBe("text/plain");
    expect(result.headers["x-custom"]).toBe("custom value");
    expect(result.body).toBe("no content type\n");
  });

  it("accepts the full (object) rule form with inline text", async () => {
    const result = await server.http("/fullFormText");
    expect(result.body).toBe("full form");
  });

  it("returns a named template with file content", async () => {
    const result = await server.http("/template");
    expect(result.body).toBe(`{"some":"thing"}`);
    expect(result.headers["content-type"]).toBe("text/json");
  });

  it("returns a named template with text content", async () => {
    const result = await server.http("/textTemplate");
    expect(result.body).toBe("template text");
    expect(result.headers["content-type"]).toBe("text/plain");
  });

  it("answers 500 for an unknown template", async () => {
    const result = await server.http("/unknownTemplate");
    expect(result.status).toBe(500);
    expect(result.headers["content-type"]).toBe("text/plain");
    expect(result.body).toBe(`Mock server error: Unknown response "unknownTemplate"`);
  });

  it("answers 500 for a missing response file", async () => {
    const result = await server.http("/missingFile");
    expect(result.status).toBe(500);
    expect(result.body).toMatch(/^Mock server error: .*doesNotExist\.txt/);
  });

  it("applies the rule delay", async () => {
    const result = await server.http("/delayed");
    expect(result.body).toBe("delayed");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(140);
  });

  it("answers immediately for an external broker reference and stays alive", async () => {
    const result = await server.http("/external");
    expect(result.status).toBe(200);
    expect(result.body).toBe("Response will be sent by kafka1:someResponse");
    expect(result.headers["content-type"]).toBe("text/plain");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await server.http("/text")).body).toBe("plain text");
    expect(server.isRunning).toBe(true);
  });
});

describe("HTTP status line", () => {
  it.each([
    ["/statusOnly", 200, "OK", "status only\n"],
    ["/statusWithText", 201, "Created", "status with text\n"],
    ["/statusHttp", 202, "Accepted", "status http\n"],
    ["/statusHttpVersion", 203, "Non-Authoritative Information", "status http version\n"],
    ["/serverError", 500, "Internal Server Error", ""],
  ])("%s → %d %s", async (url, status, statusText, body) => {
    const result = await server.http(url);
    expect(result.status).toBe(status);
    expect(result.statusText).toBe(statusText);
    expect(result.body).toBe(body);
    expect(result.headers["content-type"]).toBe("text/plain");
  });
});

describe("CORS", () => {
  it("sets permissive CORS headers on every reply", async () => {
    const result = await server.http("/text");
    expect(result.headers["access-control-allow-origin"]).toBe("*");
    expect(result.headers["access-control-allow-methods"]).toBe("*");
    expect(result.headers["access-control-allow-headers"]).toBe("*");
  });

  it("answers OPTIONS with 204 and does not record it", async () => {
    const result = await server.http("/corsPreflight", { method: "OPTIONS" });
    expect(result.status).toBe(204);
    expect(result.body).toBe("");
    expect(result.headers["access-control-allow-origin"]).toBe("*");
    const history = await server.apiJson("/get-all-requests/");
    expect(history["/corsPreflight"]).toBeUndefined();
  });
});
