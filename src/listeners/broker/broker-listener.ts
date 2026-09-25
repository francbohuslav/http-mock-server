import { normalizeRule } from "../../config/normalize";
import type { RawBrokerListenerConfig } from "../../config/raw-config";
import type { HistoryStore } from "../../history/history-store";
import { type InboundMessage, now, type OutboundMessage } from "../../messages";
import { type Logger, logMessage } from "../../shared/logger";
import type { BrokerClient, BrokerMessage, BrokerType } from "./broker-client";
import type { BrokerReplyDispatcher } from "./broker-reply-dispatcher";

/**
 * One configured Kafka or AMQP endpoint: records incoming messages and dispatches configured replies.
 * Subscriptions and rules are taken from the startup config.
 */
export class BrokerListener {
  constructor(
    public readonly name: string,
    public readonly type: BrokerType,
    private readonly config: RawBrokerListenerConfig,
    private readonly client: BrokerClient,
    private readonly history: HistoryStore,
    private readonly dispatcher: BrokerReplyDispatcher,
    private readonly logger: Logger
  ) {}

  public async start(): Promise<void> {
    this.logger.log(`${this.type === "kafka" ? "Kafka" : "AMQP"} listener ${this.name} on ${this.config.host}...`);
    await this.client.connect();
    await this.client.subscribe(Object.keys(this.config.requests || {}), (topic, message) => this.handleMessage(topic, message));
  }

  public stop(): Promise<void> {
    return this.client.close();
  }

  public async publish(topic: string, outbound: OutboundMessage): Promise<void> {
    logMessage(this.logger, `Sending ${this.type} response to topic ${topic}`, outbound.headers, outbound.body);
    await this.client.publish(topic, { headers: outbound.headers, body: outbound.body });
  }

  /**
   * Never rejects: a failing reply must not crash the process.
   */
  public async handleMessage(topic: string, message: BrokerMessage): Promise<void> {
    try {
      logMessage(this.logger, `Received ${this.type} request in ${topic} topic`, message.headers, message.body);
      const inbound: InboundMessage = { time: now(), url: topic, headers: message.headers, body: message.body };
      const entry = this.history.record(this.type, `/${topic}`, inbound, null);
      const rawRule = this.config.requests?.[topic];
      if (rawRule === undefined) {
        return;
      }
      const rule = normalizeRule(topic, rawRule);
      if (rule.replyEnabled) {
        await this.dispatcher.dispatch(rule.reply, rule.delayMs, entry, this.name);
      }
    } catch (error) {
      this.logger.error(`Error while processing ${this.type} message in topic ${topic} of listener ${this.name}`, error);
    }
  }
}
