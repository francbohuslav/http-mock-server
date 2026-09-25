import { PayloadSource } from "../config/normalize";
import { InboundMessage, OutboundMessage } from "../messages";
import { PayloadLoader } from "./payload-loader";
import { ProcessorRegistry } from "./processor-registry";

/**
 * Builds an outbound message from a payload source and an optional processor.
 */
export class ReplyBuilder {
  /**
   * @param textPayloadHeaders headers added to `text:` payloads (HTTP adds `Content-Type: text/plain`, brokers nothing)
   */
  constructor(
    private readonly loader: PayloadLoader,
    private readonly processors: ProcessorRegistry,
    private readonly textPayloadHeaders: Record<string, string>
  ) {}

  public async build(source: PayloadSource, processorName: string | undefined, inbound: InboundMessage): Promise<OutboundMessage> {
    const outbound = this.loader.load(source);
    if (source.kind === "text") {
      Object.assign(outbound.headers, this.textPayloadHeaders);
    }
    if (processorName) {
      await this.processors.run(processorName, inbound, outbound);
    }
    return outbound;
  }

  public buildText(text: string): OutboundMessage {
    return { ...this.loader.load({ kind: "text", text }), headers: { ...this.textPayloadHeaders } };
  }
}
