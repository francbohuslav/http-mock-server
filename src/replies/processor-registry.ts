import type { InboundMessage, OutboundMessage } from "../messages";

/**
 * Function exported from responses/processors.js. It mutates `responseContent`; the return value is ignored.
 */
export type ResponseProcessor = (requestContent: InboundMessage, responseContent: OutboundMessage) => unknown;

export class ProcessorRegistry {
  constructor(private readonly processors: Record<string, ResponseProcessor>) {}

  /**
   * Loads processors once at startup; the file is mandatory.
   */
  public static load(filePath: string): ProcessorRegistry {
    return new ProcessorRegistry(require(filePath));
  }

  /**
   * Runs the processor and waits for it when it returns a Promise.
   */
  public async run(processorName: string, inbound: InboundMessage, outbound: OutboundMessage): Promise<void> {
    const processor = this.processors[processorName];
    if (typeof processor !== "function") {
      throw new Error(`ResponseProcessor ${processorName} is not exported as function(requestContent, responseContent) from processors.js`);
    }
    await processor(inbound, outbound);
  }
}
