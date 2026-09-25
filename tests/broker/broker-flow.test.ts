import fs from "node:fs";
import path from "node:path";
import { InProcessApp, waitFor } from "../harness/in-process-app";

const FIXTURE_DIR = path.join(__dirname, "fixture");

function createConfig(): any {
  return {
    apiPort: 1,
    listeners: {
      http: {
        port: 1,
        requests: {
          "^/toKafka$": { response: "kafka1:fromFile", delay: 50 },
          "^/toMissing$": "missing1:x",
          "": "text:ok",
        },
      },
      kafka: {
        kafka1: {
          host: "kafka-host",
          requests: {
            in_file: { sendResponse: true, response: "fromFile" },
            in_echo: { sendResponse: true, delay: 100, response: "echo" },
            in_silent: { sendResponse: false, response: "fromFile" },
            in_implicit: { response: "fromFile" },
            in_short: "fromFile",
            in_cross: { sendResponse: true, response: "amqp1:toQueue" },
            in_failing: { sendResponse: true, response: "failing" },
            in_unknownTemplate: { sendResponse: true, response: "nope" },
            in_disabledTarget: { sendResponse: true, response: "kafkaOff:x" },
            in_inline: { sendResponse: true, response: "text:x" },
            in_noTarget: { sendResponse: true, response: "noTarget" },
          },
          responses: {
            fromFile: { content: "file:brokerReply.txt", targetTopic: "out_file" },
            echo: { content: "text:", responseProcessor: "echo", targetTopic: "out_echo" },
            failing: { content: "text:x", responseProcessor: "failing", targetTopic: "out_failing" },
            noTarget: { content: "text:x" },
          },
        },
        kafkaOff: { enabled: false, host: "off-host", requests: { in_off: "x" }, responses: { x: { content: "text:x", targetTopic: "t" } } },
      },
      amqp: {
        // No queueSettings on purpose (Q3)
        amqp1: {
          host: "amqp-host",
          requests: { in_queue: { sendResponse: true, response: "toQueue" } },
          responses: { toQueue: { content: "text:queued", targetTopic: "out_queue" } },
        },
      },
    },
  };
}

let mock: InProcessApp;

beforeEach(async () => {
  mock = await InProcessApp.create(createConfig(), FIXTURE_DIR).start();
});

afterEach(async () => {
  await mock.stop();
});

const kafka = () => mock.network.client("kafka-host");
const amqp = () => mock.network.client("amqp-host");

describe("broker listeners", () => {
  it("connects enabled listeners and subscribes to their request topics", () => {
    expect(kafka().connected).toBe(true);
    expect(kafka().type).toBe("kafka");
    expect(kafka().subscribedTopics).toStrictEqual(Object.keys(createConfig().listeners.kafka.kafka1.requests));
    expect(amqp().type).toBe("amqp");
    expect(amqp().subscribedTopics).toStrictEqual(["in_queue"]);
    expect(mock.network.clients.has("off-host")).toBe(false);
  });

  it("records an incoming message without reply when sendResponse is false", async () => {
    await kafka().emit("in_silent", "hello", { source: "abc" });
    expect(kafka().published).toStrictEqual([]);
    const entry = await mock.apiJson("/get-last-request/in_silent");
    expect(entry).toStrictEqual({
      type: "kafka",
      endpoint: "/in_silent",
      request: { time: expect.any(String), url: "in_silent", headers: { source: "abc" }, body: "hello" },
      response: null,
    });
  });

  it("does not reply when the full form omits sendResponse", async () => {
    await kafka().emit("in_implicit", "hello");
    expect(kafka().published).toStrictEqual([]);
  });

  it("publishes a file reply to the target topic and records it", async () => {
    await kafka().emit("in_file", "hello");
    expect(kafka().published).toStrictEqual([{ topic: "out_file", headers: { "X-Reply": "yes" }, body: "reply from file\n" }]);
    const entry = await mock.apiJson("/get-last-request/in_file");
    expect(entry.response).toStrictEqual({ time: expect.any(String), headers: { "X-Reply": "yes" }, body: "reply from file\n" });
  });

  // Q7: the short form of a broker rule used to crash
  it("accepts the short rule form", async () => {
    await kafka().emit("in_short", "hello");
    expect(kafka().published.map((message) => message.topic)).toStrictEqual(["out_file"]);
  });

  it("waits for the delay, then runs the processor with the incoming message", async () => {
    const start = Date.now();
    await kafka().emit("in_echo", "hello", { source: "abc" });
    expect(Date.now() - start).toBeGreaterThanOrEqual(95);
    expect(kafka().published).toStrictEqual([{ topic: "out_echo", headers: { sourceHeader: "abc" }, body: "echo in_echo: hello" }]);
  });

  it("publishes through another listener for <listener>:<template>", async () => {
    await kafka().emit("in_cross", "hello");
    expect(kafka().published).toStrictEqual([]);
    expect(amqp().published).toStrictEqual([{ topic: "out_queue", headers: {}, body: "queued" }]);
    expect((await mock.apiJson("/get-last-request/in_cross")).type).toBe("kafka");
  });

  it("replies on AMQP", async () => {
    await amqp().emit("in_queue", "hello");
    expect(amqp().published).toStrictEqual([{ topic: "out_queue", headers: {}, body: "queued" }]);
    expect((await mock.apiJson("/get-last-request/in_queue")).type).toBe("amqp");
  });

  // Q2: a failing reply used to be an unhandled rejection that crashed the process
  it.each([
    ["in_failing", "processor failed"],
    ["in_unknownTemplate", `Unknown response "nope" for listener kafka1`],
    ["in_disabledTarget", `Listener "kafkaOff" is not a running Kafka/AMQP listener`],
    ["in_inline", `Broker reply must reference a response with targetTopic, "text:x" given`],
    ["in_noTarget", `Response "noTarget" of listener kafka1 has no targetTopic`],
  ])("logs the error and publishes nothing for %s", async (topic, message) => {
    await expect(kafka().emit(topic, "hello")).resolves.toBeUndefined();
    expect(kafka().published).toStrictEqual([]);
    expect(mock.logger.errors.join("\n")).toContain(message);
    expect((await mock.apiJson(`/get-last-request/${topic}`)).response).toBeNull();
  });

  it("re-reads broker templates on every reply", async () => {
    const config = createConfig();
    config.listeners.kafka.kafka1.responses.fromFile.content = "text:changed";
    fs.writeFileSync(path.join(mock.rootDir, "config.jsonc"), JSON.stringify(config));
    await kafka().emit("in_file", "hello");
    expect(kafka().published[0].body).toBe("changed");
  });

  it("logs received and sent messages", async () => {
    await kafka().emit("in_file", "hello");
    expect(mock.logger.lines).toContain("Received kafka request in in_file topic");
    expect(mock.logger.lines).toContain("Sending kafka response to topic out_file");
  });

  it("closes the clients on stop", async () => {
    await mock.app.stop();
    expect(kafka().closed).toBe(true);
    expect(amqp().closed).toBe(true);
  });
});

describe("HTTP to broker", () => {
  // Q8: the broker reply replaces the HTTP reply in the history entry
  it("answers the HTTP request immediately and publishes after the delay", async () => {
    const result = await mock.http("/toKafka");
    expect(result.body).toBe("Response will be sent by kafka1:fromFile");
    expect(result.elapsedMs).toBeLessThan(50);
    await waitFor(() => kafka().published.length > 0);
    expect(kafka().published).toStrictEqual([{ topic: "out_file", headers: { "X-Reply": "yes" }, body: "reply from file\n" }]);
    const entry = await mock.apiJson("/get-last-request/toKafka");
    expect(entry.type).toBe("http");
    expect(entry.response.body).toBe("reply from file\n");
  });

  it("logs an error for an unknown listener", async () => {
    const result = await mock.http("/toMissing");
    expect(result.status).toBe(200);
    await waitFor(() => mock.logger.errors.length > 0);
    expect(mock.logger.errors[0]).toContain(`Listener "missing1" is not a running Kafka/AMQP listener`);
  });
});

describe("broker startup", () => {
  it("rejects duplicate listener names across Kafka and AMQP", async () => {
    const config = createConfig();
    config.listeners.amqp.kafka1 = { host: "other-host", requests: {}, responses: {} };
    const app = InProcessApp.create(config, FIXTURE_DIR);
    await expect(app.start()).rejects.toThrow("Listener kafka1 already registered");
    await app.stop();
  });

  it("rejects when a broker cannot connect", async () => {
    const app = InProcessApp.create(createConfig(), FIXTURE_DIR);
    app.network.failingHosts.add("amqp-host");
    await expect(app.start()).rejects.toThrow("Cannot connect to amqp-host");
    await app.stop();
  });

  it("reports schema violations as warnings", async () => {
    const config = createConfig();
    config.unknownKey = true;
    const app = await InProcessApp.create(config, FIXTURE_DIR).start();
    expect(app.logger.errors).toContain("Config warning: / must NOT have additional properties (unknownKey)");
    await app.stop();
  });
});
