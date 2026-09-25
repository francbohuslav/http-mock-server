import { formatReplyRef, normalizeRule, normalizeTemplate, parsePayloadSource, parseReplyRef } from "../../src/config/normalize";

describe("parsePayloadSource", () => {
  it("parses text and file", () => {
    expect(parsePayloadSource("text:a:b")).toStrictEqual({ kind: "text", text: "a:b" });
    expect(parsePayloadSource("text:")).toStrictEqual({ kind: "text", text: "" });
    expect(parsePayloadSource("file:dir/a.txt")).toStrictEqual({ kind: "file", fileName: "dir/a.txt" });
  });

  it("rejects anything else", () => {
    expect(() => parsePayloadSource("template")).toThrow("Unknown response definition template");
  });
});

describe("parseReplyRef", () => {
  it.each([
    ["text:hello", { kind: "inline", source: { kind: "text", text: "hello" } }],
    ["file:a.txt", { kind: "inline", source: { kind: "file", fileName: "a.txt" } }],
    ["myTemplate", { kind: "template", templateName: "myTemplate" }],
    ["kafka1:myTemplate", { kind: "remoteTemplate", listenerName: "kafka1", templateName: "myTemplate" }],
    ["kafka1:my:template", { kind: "remoteTemplate", listenerName: "kafka1", templateName: "my:template" }],
  ])("parses %s", (value, expected) => {
    const ref = parseReplyRef(value);
    expect(ref).toStrictEqual(expected);
    expect(formatReplyRef(ref)).toBe(value);
  });

  it("rejects a missing reference", () => {
    expect(() => parseReplyRef(undefined as unknown as string)).toThrow('Rule must define "response" as a string');
  });
});

describe("normalizeRule", () => {
  it("normalizes the short form", () => {
    expect(normalizeRule("^/a$", "text:a")).toStrictEqual({
      match: "^/a$",
      reply: { kind: "inline", source: { kind: "text", text: "a" } },
      delayMs: 0,
      replyEnabled: true,
    });
  });

  it("normalizes the full form", () => {
    expect(normalizeRule("topic", { response: "tpl", delay: 50, sendResponse: true })).toStrictEqual({
      match: "topic",
      reply: { kind: "template", templateName: "tpl" },
      delayMs: 50,
      replyEnabled: true,
    });
  });

  it("does not reply by default in the full form", () => {
    const rule = normalizeRule("topic", { response: "tpl" });
    expect(rule.replyEnabled).toBe(false);
    expect(rule.delayMs).toBe(0);
  });
});

describe("normalizeTemplate", () => {
  it("normalizes a template", () => {
    expect(normalizeTemplate("t", { content: "file:a.txt", responseProcessor: "p", targetTopic: "out" })).toStrictEqual({
      name: "t",
      source: { kind: "file", fileName: "a.txt" },
      processorName: "p",
      targetTopic: "out",
    });
  });

  it("treats an empty processor name as none", () => {
    expect(normalizeTemplate("t", { content: "text:", responseProcessor: "" }).processorName).toBeUndefined();
  });
});
