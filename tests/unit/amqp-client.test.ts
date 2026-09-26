import { EventEmitter } from "node:events";

class FakeChannel extends EventEmitter {
  public assertQueue = jest.fn(async () => ({}));
  public consume = jest.fn(async () => ({}));
  public sendToQueue = jest.fn();
  public close = jest.fn(async () => {
    this.emit("close");
  });
}

class FakeConnection extends EventEmitter {
  public readonly channel = new FakeChannel();
  public createChannel = jest.fn(async () => this.channel);
  public close = jest.fn(async () => {
    this.emit("close");
  });
}

const connections: FakeConnection[] = [];
const connectMock = jest.fn();

jest.mock("amqplib", () => ({ connect: (...args: unknown[]) => connectMock(...args) }));

import { AmqpClient } from "../../src/listeners/broker/amqp-client";
import { maskCredentials } from "../../src/shared/mask-credentials";
import { CapturingLogger, waitFor } from "../harness/in-process-app";

const FAST_RECONNECT = { initialDelayMs: 5, maxDelayMs: 20 };

function succeedConnect(): void {
  connectMock.mockImplementation(async () => {
    const connection = new FakeConnection();
    connections.push(connection);
    return connection;
  });
}

beforeEach(() => {
  connections.length = 0;
  connectMock.mockReset();
  succeedConnect();
});

describe("AmqpClient", () => {
  it("asserts queues with the last matching settings and consumes without ack", async () => {
    const client = new AmqpClient("amqp://host", { ".*": { durable: true }, "^special": { durable: false } }, new CapturingLogger());
    await client.connect();
    expect(connectMock).toHaveBeenCalledWith("amqp://host");

    const handler = jest.fn().mockResolvedValue(undefined);
    await client.subscribe(["normal", "special_queue"], handler);
    const channel = connections[0].channel;
    expect(channel.assertQueue.mock.calls).toStrictEqual([
      ["normal", { durable: true }],
      ["special_queue", { durable: false }],
    ]);
    expect(channel.consume).toHaveBeenCalledWith("normal", expect.any(Function), { noAck: true });

    const onMessage = (channel.consume.mock.calls[0] as unknown[])[1] as (message: unknown) => void;
    onMessage({ properties: { headers: { a: "1" } }, content: Buffer.from("body") });
    onMessage({ properties: {}, content: Buffer.from("") });
    onMessage(null);
    expect(handler.mock.calls).toStrictEqual([
      ["normal", { headers: { a: "1" }, body: "body" }],
      ["normal", { headers: {}, body: "" }],
    ]);
    await client.close();
  });

  it("works without queue settings and asserts a target queue once", async () => {
    const client = new AmqpClient("amqp://host", undefined, new CapturingLogger());
    await client.connect();
    await client.publish("out", { headers: { a: "1" }, body: "x" });
    await client.publish("out", { headers: {}, body: "y" });
    const channel = connections[0].channel;
    expect(channel.assertQueue.mock.calls).toStrictEqual([["out", {}]]);
    expect(channel.sendToQueue).toHaveBeenCalledWith("out", Buffer.from("x"), { headers: { a: "1" } });
    await client.close();
  });

  it("keeps retrying the first connection and logs every failure without the password", async () => {
    const logger = new CapturingLogger();
    connectMock.mockRejectedValueOnce(new Error("ECONNREFUSED")).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const client = new AmqpClient("amqp://guest:secret@host", {}, logger, FAST_RECONNECT);
    await client.connect();
    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(logger.errors).toStrictEqual([
      "AMQP amqp://guest:***@host: connection failed (ECONNREFUSED), retrying in 5 ms",
      "AMQP amqp://guest:***@host: connection failed (ECONNREFUSED), retrying in 10 ms",
    ]);
    expect(logger.lines).toContain("AMQP amqp://guest:***@host: connected");
    await client.close();
  });

  it("reconnects after a connection loss and consumes again", async () => {
    const logger = new CapturingLogger();
    const client = new AmqpClient("amqp://host", {}, logger, FAST_RECONNECT);
    await client.connect();
    await client.subscribe(["in"], jest.fn());
    await client.publish("out", { headers: {}, body: "x" });

    connections[0].emit("close");
    await waitFor(() => connections.length === 2 && connections[1].channel.consume.mock.calls.length === 1);
    expect(logger.errors).toContain("AMQP amqp://host: connection lost, reconnecting");
    const channel = connections[1].channel;
    expect(channel.assertQueue).toHaveBeenCalledWith("in", {});
    expect(channel.consume).toHaveBeenCalledWith("in", expect.any(Function), { noAck: true });

    // Queues asserted on the old channel are asserted again
    await client.publish("out", { headers: {}, body: "y" });
    expect(channel.assertQueue).toHaveBeenCalledWith("out", {});
    await client.close();
  });

  it("reconnects when the channel is closed by the broker", async () => {
    const client = new AmqpClient("amqp://host", {}, new CapturingLogger(), FAST_RECONNECT);
    await client.connect();
    connections[0].channel.emit("close");
    await waitFor(() => connections.length === 2);
    expect(connections[0].close).toHaveBeenCalled();
    await client.close();
  });

  it("does not reconnect after close and stops a pending retry", async () => {
    const client = new AmqpClient("amqp://host", {}, new CapturingLogger(), FAST_RECONNECT);
    await client.connect();
    await client.close();
    expect(connections[0].channel.close).toHaveBeenCalled();
    expect(connections[0].close).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(connections).toHaveLength(1);

    connectMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const pending = new AmqpClient("amqp://host", {}, new CapturingLogger(), { initialDelayMs: 10_000, maxDelayMs: 10_000 });
    const connecting = pending.connect();
    await waitFor(() => connectMock.mock.calls.length === 2);
    await pending.close();
    await expect(connecting).rejects.toThrow("AMQP client closed");
  });

  it("fails to publish while disconnected", async () => {
    const client = new AmqpClient("amqp://host", {}, new CapturingLogger(), { initialDelayMs: 10_000, maxDelayMs: 10_000 });
    await client.connect();
    connectMock.mockRejectedValue(new Error("ECONNREFUSED"));
    connections[0].emit("close");
    await expect(client.publish("out", { headers: {}, body: "x" })).rejects.toThrow("AMQP amqp://host is not connected");
    await client.close();
  });
});

describe("maskCredentials", () => {
  it.each([
    ["amqp://guest:guest@localhost:5672/vhost", "amqp://guest:***@localhost:5672/vhost"],
    ["amqps://user:p%40ss@host", "amqps://user:***@host"],
    ["amqp://localhost:5672", "amqp://localhost:5672"],
    ["localhost:9092", "localhost:9092"],
  ])("%s → %s", (url, expected) => {
    expect(maskCredentials(url)).toBe(expected);
  });
});
