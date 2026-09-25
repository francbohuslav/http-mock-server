import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PayloadSource } from "../config/normalize";
import { now, type OutboundMessage } from "../messages";
import { errorMessage, type Logger } from "../shared/logger";
import { type ParsedPayloadFile, parsePayloadFile } from "./payload-file-parser";

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
    let parsed: ParsedPayloadFile;
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
