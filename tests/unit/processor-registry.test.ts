import { OutboundMessage } from "../../src/messages";
import { ProcessorRegistry } from "../../src/replies/processor-registry";

const inbound = { time: "t", url: "/a", headers: {}, body: "in" };
const emptyOutbound = (): OutboundMessage => ({ time: "t", headers: {}, body: "" });

describe("ProcessorRegistry", () => {
  it("runs sync and async processors", async () => {
    const registry = new ProcessorRegistry({
      sync: (request, response) => {
        response.body = request.body + "-sync";
      },
      async: async (_request, response) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        response.body += "-async";
      },
    });
    const outbound = emptyOutbound();
    await registry.run("sync", inbound, outbound);
    await registry.run("async", inbound, outbound);
    expect(outbound.body).toBe("in-sync-async");
  });

  it("rejects an unknown processor", async () => {
    const registry = new ProcessorRegistry({});
    await expect(registry.run("nope", inbound, emptyOutbound())).rejects.toThrow("ResponseProcessor nope is not exported");
  });

  it("propagates processor errors", async () => {
    const registry = new ProcessorRegistry({
      failing: () => {
        throw new Error("boom");
      },
    });
    await expect(registry.run("failing", inbound, emptyOutbound())).rejects.toThrow("boom");
  });
});
