const producer = { connect: jest.fn(), send: jest.fn(), disconnect: jest.fn() };
const consumer = { connect: jest.fn(), subscribe: jest.fn(), run: jest.fn(), disconnect: jest.fn() };
const kafkaConstructor = jest.fn();
const consumerFactory = jest.fn((_options: unknown) => consumer);

jest.mock("kafkajs", () => ({
  Kafka: jest.fn().mockImplementation((options: unknown) => {
    kafkaConstructor(options);
    return { producer: () => producer, consumer: consumerFactory };
  }),
  Partitioners: { LegacyPartitioner: "legacy" },
  PartitionAssigners: { roundRobin: "roundRobin" },
  logLevel: { WARN: 2 },
}));

import { fromKafkaHeaders, KafkaClient, toKafkaHeaders } from "../../src/listeners/broker/kafka-client";

describe("KafkaClient", () => {
  it("connects with a unique consumer group and subscribes without history", async () => {
    const client = new KafkaClient("localhost:9092");
    await client.connect();
    expect(kafkaConstructor).toHaveBeenCalledWith(expect.objectContaining({ clientId: "http-mock-server", brokers: ["localhost:9092"] }));
    expect(consumerFactory).toHaveBeenCalledWith({ groupId: expect.stringMatching(/^group_id\.mockserver\d+$/), partitionAssigners: ["roundRobin"] });

    const handler = jest.fn().mockResolvedValue(undefined);
    await client.subscribe(["a", "b"], handler);
    expect(consumer.subscribe).toHaveBeenCalledWith({ topics: ["a", "b"], fromBeginning: false });

    const { eachMessage } = consumer.run.mock.calls[0][0];
    await eachMessage({ topic: "a", message: { headers: { h: Buffer.from("v") }, value: Buffer.from("body") } });
    await eachMessage({ topic: "a", message: { headers: undefined, value: null } });
    expect(handler.mock.calls).toStrictEqual([
      ["a", { headers: { h: "v" }, body: "body" }],
      ["a", { headers: {}, body: "" }],
    ]);
  });

  it("publishes body and headers", async () => {
    const client = new KafkaClient("host");
    await client.connect();
    await client.publish("out", { headers: { a: "1", n: 2, skip: undefined }, body: "x" });
    expect(producer.send).toHaveBeenCalledWith({ topic: "out", messages: [{ headers: { a: "1", n: "2" }, value: "x" }] });
  });

  it("converts headers", () => {
    expect(fromKafkaHeaders({ a: Buffer.from("1"), b: [Buffer.from("x"), "y"], c: undefined })).toStrictEqual({ a: "1", b: ["x", "y"] });
    const buffer = Buffer.from("b");
    expect(toKafkaHeaders({ a: buffer, b: true, c: null })).toStrictEqual({ a: buffer, b: "true" });
  });
});
