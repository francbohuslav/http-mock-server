import { DEFAULT_HISTORY_LIMIT, HistoryStore } from "../../src/history/history-store";

const inbound = (body: string) => ({ time: "t", url: "/a", headers: {}, body });

function bodies(store: HistoryStore, endpoint: string): string[] {
  return (store.all().get(endpoint) || []).map((entry) => entry.inbound.body as string);
}

describe("HistoryStore", () => {
  it("groups entries by endpoint and returns the last one", () => {
    const store = new HistoryStore();
    store.record("http", "/a", inbound("1"), null);
    const second = store.record("http", "/a", inbound("2"), { time: "t", headers: {}, body: "reply" });
    store.record("kafka", "/topic", inbound("3"), null);
    expect(store.last("/a")).toBe(second);
    expect([...store.all().keys()]).toStrictEqual(["/a", "/topic"]);
    expect(store.all().get("/a")).toHaveLength(2);
    expect(store.last("/unknown")).toBeUndefined();
  });

  it("clears everything", () => {
    const store = new HistoryStore();
    store.record("http", "/a", inbound("1"), null);
    store.clear();
    expect(store.all().size).toBe(0);
  });

  it("keeps the 10 newest entries per endpoint by default", () => {
    expect(DEFAULT_HISTORY_LIMIT).toBe(10);
    const store = new HistoryStore();
    for (let i = 1; i <= 12; i++) {
      store.record("http", "/a", inbound(String(i)), null);
    }
    store.record("http", "/b", inbound("b"), null);
    expect(bodies(store, "/a")).toStrictEqual(["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    expect(bodies(store, "/b")).toStrictEqual(["b"]);
  });

  it("applies a custom limit, also to existing entries", () => {
    const store = new HistoryStore();
    for (let i = 1; i <= 5; i++) {
      store.record("http", "/a", inbound(String(i)), null);
    }
    store.setLimit(2);
    expect(bodies(store, "/a")).toStrictEqual(["4", "5"]);
    store.record("http", "/a", inbound("6"), null);
    expect(bodies(store, "/a")).toStrictEqual(["5", "6"]);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects limit %s", (limit) => {
    expect(() => new HistoryStore().setLimit(limit)).toThrow("historyLimit must be a positive integer");
  });
});
