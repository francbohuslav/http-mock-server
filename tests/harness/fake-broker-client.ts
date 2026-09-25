import { RawBrokerListenerConfig } from "../../src/config/raw-config";
import { BrokerClient, BrokerClientFactory, BrokerMessage, BrokerMessageHandler, BrokerType } from "../../src/listeners/broker/broker-client";

export interface PublishedMessage extends BrokerMessage {
  topic: string;
}

/**
 * In-memory broker client: records published messages and lets tests deliver incoming messages.
 */
export class FakeBrokerClient implements BrokerClient {
  public readonly published: PublishedMessage[] = [];
  public subscribedTopics: string[] = [];
  public connected = false;
  public closed = false;
  public connectError?: Error;
  private handler?: BrokerMessageHandler;

  constructor(
    public readonly type: BrokerType,
    public readonly config: RawBrokerListenerConfig
  ) {}

  public async connect(): Promise<void> {
    if (this.connectError) {
      throw this.connectError;
    }
    this.connected = true;
  }

  public async subscribe(topics: string[], handler: BrokerMessageHandler): Promise<void> {
    this.subscribedTopics = topics;
    this.handler = handler;
  }

  public async publish(topic: string, message: BrokerMessage): Promise<void> {
    this.published.push({ topic, ...message });
  }

  public async close(): Promise<void> {
    this.closed = true;
  }

  /**
   * Delivers a message like the broker would and resolves when the listener has processed it.
   */
  public async emit(topic: string, body: string, headers: Record<string, unknown> = {}): Promise<void> {
    if (!this.handler) {
      throw new Error(`${this.type} client is not subscribed`);
    }
    await this.handler(topic, { headers, body });
  }
}

/**
 * Factory that creates fake clients and remembers them by host (host is unique per listener in tests).
 */
export class FakeBrokerNetwork {
  public readonly clients = new Map<string, FakeBrokerClient>();
  public readonly failingHosts = new Set<string>();

  public readonly factory: BrokerClientFactory = (type, config) => {
    const client = new FakeBrokerClient(type, config);
    if (this.failingHosts.has(config.host)) {
      client.connectError = new Error(`Cannot connect to ${config.host}`);
    }
    this.clients.set(config.host, client);
    return client;
  };

  public client(host: string): FakeBrokerClient {
    const client = this.clients.get(host);
    if (!client) {
      throw new Error(`No client for host ${host}`);
    }
    return client;
  }
}
