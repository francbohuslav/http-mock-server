import { type Channel, type ChannelModel, connect, type Options } from "amqplib";
import type { BrokerClient, BrokerMessage, BrokerMessageHandler } from "./broker-client";

export class AmqpClient implements BrokerClient {
  private connection?: ChannelModel;
  private channel?: Channel;
  private readonly assertedQueues = new Set<string>();

  /**
   * @param queueSettings queue regex → assertQueue options; when more regexes match, the last one wins
   */
  constructor(
    private readonly host: string,
    private readonly queueSettings: Record<string, object> = {}
  ) {}

  public async connect(): Promise<void> {
    // SSL: use amqps:// and pass socket options { cert, key, passphrase, ca, rejectUnauthorized } as the second argument
    this.connection = await connect(this.host);
    this.channel = await this.connection.createChannel();
  }

  public async subscribe(topics: string[], handler: BrokerMessageHandler): Promise<void> {
    const channel = this.requireChannel();
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

  public async publish(queue: string, message: BrokerMessage): Promise<void> {
    await this.assertQueue(queue);
    this.requireChannel().sendToQueue(queue, Buffer.from(message.body), { headers: message.headers });
  }

  public async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
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

  private async assertQueue(queue: string): Promise<void> {
    if (this.assertedQueues.has(queue)) {
      return;
    }
    await this.requireChannel().assertQueue(queue, this.queueOptions(queue));
    this.assertedQueues.add(queue);
  }

  private requireChannel(): Channel {
    if (!this.channel) {
      throw new Error("AMQP client is not connected");
    }
    return this.channel;
  }
}
