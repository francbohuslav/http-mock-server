import { HistoryStore } from "../../src/history/history-store";

const inbound = (body: string) => ({ time: "t", url: "/a", headers: {}, body });

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
});
