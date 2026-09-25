import { Consumer, IHeaders, Kafka, logLevel, Partitioners, PartitionAssigners, Producer } from "kafkajs";
import { BrokerClient, BrokerMessage, BrokerMessageHandler } from "./broker-client";

export class KafkaClient implements BrokerClient {
  private readonly kafka: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;

  constructor(host: string) {
    this.kafka = new Kafka({ clientId: "http-mock-server", brokers: [host], logLevel: logLevel.WARN });
  }

  public async connect(): Promise<void> {
    this.producer = this.kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
    // A new consumer group on every start, so only messages produced after the start are received
    this.consumer = this.kafka.consumer({ groupId: "group_id.mockserver" + Date.now(), partitionAssigners: [PartitionAssigners.roundRobin] });
    await this.producer.connect();
    await this.consumer.connect();
  }

  public async subscribe(topics: string[], handler: BrokerMessageHandler): Promise<void> {
    const consumer = this.requireConnected(this.consumer);
    if (!topics.length) {
      return;
    }
    await consumer.subscribe({ topics, fromBeginning: false });
    await consumer.run({
      eachMessage: ({ topic, message }) => handler(topic, { headers: fromKafkaHeaders(message.headers), body: message.value?.toString() ?? "" }),
    });
  }

  public async publish(topic: string, message: BrokerMessage): Promise<void> {
    await this.requireConnected(this.producer).send({ topic, messages: [{ headers: toKafkaHeaders(message.headers), value: message.body }] });
  }

  public async close(): Promise<void> {
    await this.consumer?.disconnect();
    await this.producer?.disconnect();
  }

  private requireConnected<T>(value: T | undefined): T {
    if (!value) {
      throw new Error("Kafka client is not connected");
    }
    return value;
  }
}

/**
 * Kafka delivers header values as Buffers; the mock works with strings.
 */
export function fromKafkaHeaders(headers: IHeaders | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (value !== undefined) {
      result[name] = Array.isArray(value) ? value.map(String) : String(value);
    }
  }
  return result;
}

export function toKafkaHeaders(headers: Record<string, unknown>): IHeaders {
  const result: IHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) {
      result[name] = Buffer.isBuffer(value) ? value : String(value);
    }
  }
  return result;
}
