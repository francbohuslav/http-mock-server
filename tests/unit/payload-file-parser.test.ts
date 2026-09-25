import { parsePayloadFile } from "../../src/replies/payload-file-parser";

function parse(text: string) {
  const warnings: string[] = [];
  const result = parsePayloadFile(text, (warning) => warnings.push(warning));
  return { ...result, warnings };
}

describe("parsePayloadFile", () => {
  it("parses headers and body", () => {
    expect(parse("Content-Type: application/json\nX-A: 1\n\n{}")).toStrictEqual({
      headers: { "Content-Type": "application/json", "X-A": "1" },
      body: "{}",
      warnings: [],
    });
  });

  it.each([
    ["HTTP/1.1 200 OK", 200, "OK"],
    ["HTTP/2 404 Not Found", 404, "Not Found"],
    ["HTTP 201 Created", 201, "Created"],
    ["202 Accepted", 202, "Accepted"],
    ["204", 204, undefined],
    ["500 Internal Server Error", 500, "Internal Server Error"],
  ])("parses status line %s", (line, statusCode, statusMessage) => {
    const result = parse(`${line}\nX-A: 1\n\nbody`);
    expect(result.statusCode).toBe(statusCode);
    expect(result.statusMessage).toBe(statusMessage);
    expect(result.headers).toStrictEqual({ "X-A": "1" });
  });

  it("does not treat a later line as status line", () => {
    const result = parse("X-A: 1\n200 OK\n\nbody");
    expect(result.statusCode).toBeUndefined();
    expect(result.warnings).toStrictEqual(["Line 200 OK is not valid header"]);
  });

  it("warns about an invalid first line", () => {
    const result = parse("HTTP OK\n\nbody");
    expect(result.statusCode).toBeUndefined();
    expect(result.warnings).toStrictEqual(["Line HTTP OK is not valid header"]);
  });

  it("warns about a header without name", () => {
    const result = parse("X-A: 1\n: value\n\nbody");
    expect(result.headers).toStrictEqual({ "X-A": "1" });
    expect(result.warnings).toHaveLength(1);
  });

  it("splits headers on the first colon", () => {
    expect(parse("Location: http://host:8080/a\n\n").headers).toStrictEqual({ Location: "http://host:8080/a" });
  });

  it("strips BOM and CR but keeps body whitespace", () => {
    const result = parse("﻿X-A:  1  \r\n\r\n  indented  \r\n\ttab\r\n");
    expect(result.headers).toStrictEqual({ "X-A": "1" });
    expect(result.body).toBe("  indented  \n\ttab\n");
  });

  it("treats a whitespace-only line as separator", () => {
    expect(parse("X-A: 1\n   \nbody").body).toBe("body");
  });

  it("accepts an empty header section and an empty body", () => {
    expect(parse("\n")).toStrictEqual({ headers: {}, body: "", warnings: [] });
  });

  it("rejects a file without an empty line", () => {
    expect(() => parse("X-A: 1\nbody")).toThrow("Response file must contain headers, an empty line and a body");
  });
});
