const channel = { assertQueue: jest.fn(), consume: jest.fn(), sendToQueue: jest.fn(), close: jest.fn() };
const connection = { createChannel: jest.fn(async () => channel), close: jest.fn() };

jest.mock("amqplib", () => ({ connect: jest.fn(async () => connection) }));

import { connect } from "amqplib";
import { AmqpClient } from "../../src/listeners/broker/amqp-client";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AmqpClient", () => {
  it("asserts queues with the last matching settings and consumes without ack", async () => {
    const client = new AmqpClient("amqp://host", { ".*": { durable: true }, "^special": { durable: false } });
    await client.connect();
    expect(connect).toHaveBeenCalledWith("amqp://host");

    const handler = jest.fn().mockResolvedValue(undefined);
    await client.subscribe(["normal", "special_queue"], handler);
    expect(channel.assertQueue.mock.calls).toStrictEqual([
      ["normal", { durable: true }],
      ["special_queue", { durable: false }],
    ]);
    expect(channel.consume).toHaveBeenCalledWith("normal", expect.any(Function), { noAck: true });

    const onMessage = channel.consume.mock.calls[0][1];
    onMessage({ properties: { headers: { a: "1" } }, content: Buffer.from("body") });
    onMessage({ properties: {}, content: Buffer.from("") });
    onMessage(null);
    expect(handler.mock.calls).toStrictEqual([
      ["normal", { headers: { a: "1" }, body: "body" }],
      ["normal", { headers: {}, body: "" }],
    ]);
  });

  it("works without queue settings and asserts a target queue once", async () => {
    const client = new AmqpClient("amqp://host");
    await client.connect();
    await client.publish("out", { headers: { a: "1" }, body: "x" });
    await client.publish("out", { headers: {}, body: "y" });
    expect(channel.assertQueue.mock.calls).toStrictEqual([["out", {}]]);
    expect(channel.sendToQueue).toHaveBeenCalledWith("out", Buffer.from("x"), { headers: { a: "1" } });
  });

  it("closes channel and connection", async () => {
    const client = new AmqpClient("amqp://host");
    await client.connect();
    await client.close();
    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });
});
