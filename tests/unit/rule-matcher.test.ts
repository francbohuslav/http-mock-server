import { matchRule } from "../../src/listeners/rule-matcher";

describe("matchRule", () => {
  const rules = { "^/a": "text:a", "^/a/b": "text:b", "\\?x=1$": "text:query", "": "text:default" };

  it("returns the first match in key order", () => {
    expect(matchRule(rules, "/a/b")?.match).toBe("^/a");
  });

  it("matches the query string", () => {
    expect(matchRule(rules, "/c?x=1")?.match).toBe("\\?x=1$");
  });

  it("uses the empty key as catch-all", () => {
    expect(matchRule(rules, "/zzz")?.match).toBe("");
  });

  it("returns undefined when nothing matches", () => {
    expect(matchRule({ "^/a$": "text:a" }, "/b")).toBeUndefined();
  });

  it("throws on an invalid regex", () => {
    expect(() => matchRule({ "(": "text:a" }, "/b")).toThrow();
  });
});
