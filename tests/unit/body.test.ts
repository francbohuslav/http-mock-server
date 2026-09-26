import { bodyToBuffer, decodeBody, describeBody, withJsonBody } from "../../src/shared/body";

describe("decodeBody", () => {
  it("decodes UTF-8 text including a BOM", () => {
    expect(decodeBody(Buffer.from("žluťoučký"))).toBe("žluťoučký");
    expect(decodeBody(Buffer.from("﻿text"))).toBe("﻿text");
    expect(decodeBody(Buffer.alloc(0))).toBe("");
  });

  it("keeps invalid UTF-8 as a Buffer", () => {
    const bytes = Buffer.from([0x89, 0x50, 0xff, 0x00]);
    const body = decodeBody(bytes);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect((body as Buffer).equals(bytes)).toBe(true);
  });
});

describe("helpers", () => {
  it("converts to a Buffer", () => {
    expect(bodyToBuffer("a").equals(Buffer.from("a"))).toBe(true);
    const buffer = Buffer.from([1]);
    expect(bodyToBuffer(buffer)).toBe(buffer);
  });

  it("describes a body for logs", () => {
    expect(describeBody("text")).toBe("text");
    expect(describeBody("")).toBe("{no body}");
    expect(describeBody(Buffer.from([0xff, 0x00]))).toBe("{binary body, 2 bytes}");
  });

  it("encodes binary bodies for JSON only", () => {
    expect(withJsonBody({ time: "t", body: "text" })).toStrictEqual({ time: "t", body: "text" });
    expect(withJsonBody({ time: "t", body: Buffer.from([0xff, 0x00]) })).toStrictEqual({ time: "t", body: "/wA=", bodyEncoding: "base64" });
  });
});
