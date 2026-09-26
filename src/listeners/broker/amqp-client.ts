import { type Channel, type ChannelModel, connect, type Options } from "amqplib";
import { errorMessage, type Logger } from "../../shared/logger";
import { maskCredentials } from "../../shared/mask-credentials";
import type { BrokerClient, BrokerMessage, BrokerMessageHandler } from "./broker-client";

export interface ReconnectOptions {
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RECONNECT: ReconnectOptions = { initialDelayMs: 500, maxDelayMs: 30_000 };

/**
 * AMQP client that keeps reconnecting: at startup until the broker is reachable and after every connection loss.
 * Queues and consumers are set up again after each reconnect.
 */
export class AmqpClient implements BrokerClient {
  private connection?: ChannelModel;
  private channel?: Channel;
  private readonly assertedQueues = new Set<string>();
  private subscription?: { topics: string[]; handler: BrokerMessageHandler };
  private closing = false;
  private reconnectTimer?: NodeJS.Timeout;
  private cancelReconnect?: () => void;

  /**
   * @param queueSettings queue regex → assertQueue options; when more regexes match, the last one wins
   */
  constructor(
    private readonly host: string,
    private readonly queueSettings: Record<string, object> = {},
    private readonly logger: Logger = console,
    private readonly reconnect: ReconnectOptions = DEFAULT_RECONNECT
  ) {}

  public connect(): Promise<void> {
    return this.openWithRetry();
  }

  public async subscribe(topics: string[], handler: BrokerMessageHandler): Promise<void> {
    this.subscription = { topics, handler };
    await this.consumeAll();
  }

  public async publish(queue: string, message: BrokerMessage): Promise<void> {
    await this.assertQueue(queue);
    this.requireChannel().sendToQueue(queue, Buffer.from(message.body), { headers: message.headers });
  }

  public async close(): Promise<void> {
    this.closing = true;
    clearTimeout(this.reconnectTimer);
    this.cancelReconnect?.();
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  public queueOptions(queue: string): Options.AssertQueue {
    let options = {};
    for (const [mask, settings] of Object.entries(this.queueSettings)) {
      if (new RegExp(mask).test(queue)) {
        options = settings;
      }
    }
    return options;
  }

  /**
   * Resolves once connected; rejects only when the client is closed meanwhile.
   */
  private async openWithRetry(): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.open();
        if (attempt > 1) {
          this.logger.log(`AMQP ${this.displayHost()}: connected`);
        }
        return;
      } catch (error) {
        if (this.closing) {
          throw new Error("AMQP client closed", { cause: error });
        }
        const delayMs = Math.min(this.reconnect.initialDelayMs * 2 ** (attempt - 1), this.reconnect.maxDelayMs);
        this.logger.error(`AMQP ${this.displayHost()}: connection failed (${errorMessage(error)}), retrying in ${delayMs} ms`);
        await this.wait(delayMs);
      }
    }
  }

  private async open(): Promise<void> {
    // SSL: use amqps:// and pass socket options { cert, key, passphrase, ca, rejectUnauthorized } as the second argument
    const connection = await connect(this.host);
    connection.on("error", (error) => this.logger.error(`AMQP ${this.displayHost()}: connection error (${errorMessage(error)})`));
    try {
      const channel = await connection.createChannel();
      channel.on("error", (error) => this.logger.error(`AMQP ${this.displayHost()}: channel error (${errorMessage(error)})`));
      // Consumers die with the channel, so a closed channel reconnects the whole connection
      channel.on("close", () => {
        if (!this.closing && this.connection === connection) {
          connection.close().catch(() => undefined);
        }
      });
      this.connection = connection;
      this.channel = channel;
      this.assertedQueues.clear();
      await this.consumeAll();
    } catch (error) {
      this.connection = undefined;
      this.channel = undefined;
      await connection.close().catch(() => undefined);
      throw error;
    }
    connection.on("close", () => this.onConnectionLost());
  }

  private onConnectionLost(): void {
    this.channel = undefined;
    this.connection = undefined;
    if (this.closing) {
      return;
    }
    this.logger.error(`AMQP ${this.displayHost()}: connection lost, reconnecting`);
    this.openWithRetry().catch(() => undefined);
  }

  private async consumeAll(): Promise<void> {
    if (!this.subscription || !this.channel) {
      return;
    }
    const channel = this.channel;
    const { topics, handler } = this.subscription;
    for (const queue of topics) {
      await this.assertQueue(queue);
    }
    for (const queue of topics) {
      await channel.consume(
        queue,
        (message) => {
          if (message) {
            void handler(queue, { headers: message.properties.headers || {}, body: message.content.toString() });
          }
        },
        { noAck: true }
      );
    }
  }

  private async assertQueue(queue: string): Promise<void> {
    if (this.assertedQueues.has(queue)) {
      return;
    }
    await this.requireChannel().assertQueue(queue, this.queueOptions(queue));
    this.assertedQueues.add(queue);
  }

  private requireChannel(): Channel {
    if (!this.channel) {
      throw new Error(`AMQP ${this.displayHost()} is not connected`);
    }
    return this.channel;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cancelReconnect = () => reject(new Error("AMQP client closed"));
      this.reconnectTimer = setTimeout(resolve, ms);
    });
  }

  private displayHost(): string {
    return maskCredentials(this.host);
  }
}
