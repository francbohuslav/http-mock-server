import http, { type IncomingMessage, type OutgoingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { ConfigProvider } from "../config/config-provider";
import { formatReplyRef, normalizeTemplate, type Rule } from "../config/normalize";
import type { RawHttpListenerConfig } from "../config/raw-config";
import type { HistoryEntry, HistoryStore } from "../history/history-store";
import { type InboundMessage, now, type OutboundMessage } from "../messages";
import type { ReplyBuilder } from "../replies/reply-builder";
import { type Body, decodeBody } from "../shared/body";
import { closeServer } from "../shared/close-server";
import { delay } from "../shared/delay";
import { errorMessage, type Logger, logMessage } from "../shared/logger";
import type { BrokerReplyDispatcher } from "./broker/broker-reply-dispatcher";
import { matchRule } from "./rule-matcher";

/**
 * Answers HTTP requests by the rules in `listeners.http`. Rules and templates are read from the current config on every request.
 */
export class HttpListener {
  private server?: http.Server;

  constructor(
    private readonly configProvider: ConfigProvider,
    private readonly builder: ReplyBuilder,
    private readonly dispatcher: BrokerReplyDispatcher,
    private readonly history: HistoryStore,
    private readonly logger: Logger
  ) {}

  public listen(port: number): Promise<number> {
    this.logger.log(`HTTP listener on port ${port}...`);
    const server = http.createServer((request, response) => this.handleRequest(request, response));
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, () => resolve((server.address() as AddressInfo).port));
    });
  }

  public close(): Promise<void> {
    return closeServer(this.server);
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    setCorsHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    // Chunks are joined as bytes: decoding each chunk alone would break multi-byte characters and binary data
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      this.respond(request, decodeBody(Buffer.concat(chunks)), response).catch((error) => {
        this.logger.error(`Error while answering request ${request.url}`, error);
        if (!response.headersSent) {
          response.statusCode = 500;
        }
        response.end();
      });
    });
  }

  private async respond(request: IncomingMessage, body: Body, response: ServerResponse): Promise<void> {
    const url = request.url || "";
    const inbound: InboundMessage = { time: now(), url, headers: request.headers, body };
    logMessage(this.logger, `Received ${request.method} request for ${url}`, inbound.headers, body);

    let rule: Rule | undefined;
    let outbound: OutboundMessage;
    try {
      rule = this.findRule(url);
      outbound = await this.buildReply(rule, inbound);
      writeReply(response, outbound);
    } catch (error) {
      this.logger.error(`Error while processing request ${url}`, error);
      rule = undefined;
      outbound = this.builder.buildText(`Mock server error: ${errorMessage(error)}`);
      outbound.statusCode = 500;
      outbound.error = String(error);
      writeReply(response, outbound);
    }
    outbound.time = now();
    const entry = this.history.record("http", url, inbound, outbound);
    response.end(outbound.body);

    if (rule?.reply.kind === "remoteTemplate") {
      this.dispatchToBroker(rule, entry);
    }
  }

  private findRule(url: string): Rule {
    const rule = matchRule(this.currentConfig().requests || {}, url);
    if (!rule) {
      throw new Error("Unknown request");
    }
    return rule;
  }

  /**
   * Order: processor, then delay. A reference to a broker template answers immediately; the delay applies to the broker reply.
   */
  private async buildReply(rule: Rule, inbound: InboundMessage): Promise<OutboundMessage> {
    const ref = rule.reply;
    if (ref.kind === "remoteTemplate") {
      return this.builder.buildText(`Response will be sent by ${formatReplyRef(ref)}`);
    }
    let outbound: OutboundMessage;
    if (ref.kind === "template") {
      const rawTemplate = this.currentConfig().responses?.[ref.templateName];
      if (!rawTemplate) {
        throw new Error(`Unknown response "${ref.templateName}"`);
      }
      const template = normalizeTemplate(ref.templateName, rawTemplate);
      outbound = await this.builder.build(template.source, template.processorName, inbound);
    } else {
      outbound = await this.builder.build(ref.source, undefined, inbound);
    }
    if (rule.delayMs) {
      await delay(rule.delayMs);
    }
    return outbound;
  }

  private dispatchToBroker(rule: Rule, entry: HistoryEntry): void {
    this.dispatcher
      .dispatch(rule.reply, rule.delayMs, entry, "http")
      .catch((error) => this.logger.error(`Error while sending response ${formatReplyRef(rule.reply)}`, error));
  }

  private currentConfig(): RawHttpListenerConfig {
    const config = this.configProvider.load().listeners.http;
    if (!config) {
      throw new Error("HTTP listener is not configured");
    }
    return config;
  }
}

function setCorsHeaders(response: OutgoingMessage): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "*");
  response.setHeader("Access-Control-Allow-Headers", "*");
}

/**
 * Validates everything first, so that an invalid header (e.g. set by a processor) fails before anything is written.
 */
function writeReply(response: ServerResponse, outbound: OutboundMessage): void {
  const headers: [string, string | string[]][] = [
    ["Server", "HttpMockServer"],
    ["Content-Type", "text/plain"],
  ];
  for (const [name, value] of Object.entries(outbound.headers)) {
    if (value === undefined || value === null) {
      continue;
    }
    const headerValue = Array.isArray(value) ? value.map(String) : String(value);
    http.validateHeaderName(name);
    for (const item of [headerValue].flat()) {
      http.validateHeaderValue(name, item);
    }
    headers.push([name, headerValue]);
  }
  for (const [name, value] of headers) {
    response.setHeader(name, value);
  }
  response.statusCode = outbound.statusCode ?? 200;
  if (outbound.statusMessage) {
    response.statusMessage = outbound.statusMessage;
  }
}
