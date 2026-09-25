import { readFileSync } from "fs";
import { join } from "path";
import { PayloadSource } from "../config/normalize";
import { now, OutboundMessage } from "../messages";
import { errorMessage, Logger } from "../shared/logger";
import { parsePayloadFile } from "./payload-file-parser";

/**
 * Turns a payload source into a fresh outbound message. Files are read on every call, so they can be edited without restart.
 */
export class PayloadLoader {
  constructor(
    private readonly responsesDir: string,
    private readonly logger: Logger
  ) {}

  public load(source: PayloadSource): OutboundMessage {
    if (source.kind === "text") {
      return { time: now(), headers: {}, body: source.text };
    }
    const filePath = join(this.responsesDir, source.fileName);
    let parsed;
    try {
      parsed = parsePayloadFile(readFileSync(filePath, "utf-8"), (warning) => this.logger.error(`${warning} (file ${filePath})`));
    } catch (error) {
      throw new Error(`Response file ${filePath}: ${errorMessage(error)}`, { cause: error });
    }
    const message: OutboundMessage = { time: now(), headers: parsed.headers, body: parsed.body };
    if (parsed.statusCode !== undefined) {
      message.statusCode = parsed.statusCode;
      message.statusMessage = parsed.statusMessage;
    }
    return message;
  }
}
