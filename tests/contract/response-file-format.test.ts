import { MockServerProcess } from "../harness/mock-server-process";
import { createHttpConfig, FIXTURE_DIR } from "./contract-config";

let server: MockServerProcess;

beforeAll(async () => {
  server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
});

afterAll(async () => {
  await server.stop();
});

describe("response file format", () => {
  it("strips a BOM and CRLF line endings", async () => {
    server.writeResponseFile("reloadable.txt", "﻿Content-Type: application/json\r\nX-Other: 1\r\n\r\nline 1\r\nline 2\r\n");
    const result = await server.http("/reloadable");
    expect(result.headers["content-type"]).toBe("application/json");
    expect(result.headers["x-other"]).toBe("1");
    expect(result.body).toBe("line 1\nline 2\n");
  });

  it("trims header names and values", async () => {
    server.writeResponseFile("reloadable.txt", "  X-Spaced  :   value   \n\nbody");
    const result = await server.http("/reloadable");
    expect(result.headers["x-spaced"]).toBe("value");
  });

  it("ignores lines that are not headers", async () => {
    const result = await server.http("/invalidHeader");
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toBe("application/json");
    expect(result.headers["x-valid"]).toBe("yes");
    expect(result.body).toBe("body\n");
  });

  it("evaluates the status line only on the first line", async () => {
    server.writeResponseFile("reloadable.txt", "X-First: 1\n201 Created\n\nbody");
    const result = await server.http("/reloadable");
    expect(result.status).toBe(200);
    expect(result.headers["x-first"]).toBe("1");
  });

  it("ignores an invalid status line", async () => {
    server.writeResponseFile("reloadable.txt", "not a status\nX-First: 1\n\nbody");
    const result = await server.http("/reloadable");
    expect(result.status).toBe(200);
    expect(result.headers["x-first"]).toBe("1");
    expect(result.body).toBe("body");
  });

  it("keeps empty lines inside the body", async () => {
    server.writeResponseFile("reloadable.txt", "X-A: 1\n\na\n\nb");
    const result = await server.http("/reloadable");
    expect(result.body).toBe("a\n\nb");
  });

  it("accepts a file with no headers", async () => {
    server.writeResponseFile("reloadable.txt", "\nonly body");
    const result = await server.http("/reloadable");
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toBe("text/plain");
    expect(result.body).toBe("only body");
  });

  // Regression: body lines used to be trimmed which destroyed indentation
  it("preserves indentation of the body", async () => {
    const result = await server.http("/indentedJson");
    expect(result.body).toBe(`{\n  "nested": {\n    "value": 1\n  }\n}\n`);
  });
});
