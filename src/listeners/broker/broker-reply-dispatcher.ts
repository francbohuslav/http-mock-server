import type { ConfigProvider } from "../../config/config-provider";
import { formatReplyRef, normalizeTemplate, type ReplyRef } from "../../config/normalize";
import type { HistoryEntry } from "../../history/history-store";
import { now } from "../../messages";
import type { ReplyBuilder } from "../../replies/reply-builder";
import { delay } from "../../shared/delay";
import type { BrokerRegistry } from "./broker-registry";

/**
 * Sends a reply through a broker listener: for broker rules and for HTTP rules referencing `<listener>:<template>`.
 * Templates are read from the current config, so they can be edited without restart.
 */
export class BrokerReplyDispatcher {
  constructor(
    private readonly configProvider: ConfigProvider,
    private readonly registry: BrokerRegistry,
    private readonly builder: ReplyBuilder
  ) {}

  /**
   * Order: delay, build (including the processor), store to history, publish.
   *
   * @param entry history entry of the incoming message; its `outbound` is replaced by the sent reply
   * @param defaultListenerName listener used for references without a listener name
   */
  public async dispatch(ref: ReplyRef, delayMs: number, entry: HistoryEntry, defaultListenerName: string): Promise<void> {
    if (delayMs) {
      await delay(delayMs);
    }
    if (ref.kind === "inline") {
      throw new Error(`Broker reply must reference a response with targetTopic, "${formatReplyRef(ref)}" given`);
    }
    const listenerName = ref.kind === "remoteTemplate" ? ref.listenerName : defaultListenerName;
    const listener = this.registry.get(listenerName);
    if (!listener) {
      throw new Error(`Listener "${listenerName}" is not a running Kafka/AMQP listener (unknown or disabled)`);
    }
    const listenerConfig = this.configProvider.load().listeners[listener.type]?.[listenerName];
    const rawTemplate = listenerConfig?.responses?.[ref.templateName];
    if (!rawTemplate) {
      throw new Error(`Unknown response "${ref.templateName}" for listener ${listenerName}`);
    }
    const template = normalizeTemplate(ref.templateName, rawTemplate);
    if (!template.targetTopic) {
      throw new Error(`Response "${ref.templateName}" of listener ${listenerName} has no targetTopic`);
    }

    const outbound = await this.builder.build(template.source, template.processorName, entry.inbound);
    outbound.time = now();
    entry.outbound = outbound;
    await listener.publish(template.targetTopic, outbound);
  }
}
