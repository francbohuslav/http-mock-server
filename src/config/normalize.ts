import type { RawReplyTemplate, RawRule } from "./raw-config";

/**
 * Where the headers, status and body of a reply come from.
 */
export type PayloadSource = { kind: "text"; text: string } | { kind: "file"; fileName: string };

/**
 * What a rule replies with.
 */
export type ReplyRef =
  | { kind: "inline"; source: PayloadSource }
  | { kind: "template"; templateName: string }
  | { kind: "remoteTemplate"; listenerName: string; templateName: string };

/**
 * One entry of a listener's `requests` section: what comes in → what goes out.
 */
export interface Rule {
  /** URL regex (HTTP) or topic/queue name (brokers). */
  match: string;
  reply: ReplyRef;
  delayMs: number;
  /** Brokers only (`sendResponse`); the HTTP listener always replies. */
  replyEnabled: boolean;
}

/**
 * One entry of a listener's `responses` section.
 */
export interface ReplyTemplate {
  name: string;
  source: PayloadSource;
  processorName?: string;
  targetTopic?: string;
}

const TEXT_PREFIX = "text:";
const FILE_PREFIX = "file:";

export function parsePayloadSource(value: string): PayloadSource {
  if (typeof value === "string" && value.startsWith(TEXT_PREFIX)) {
    return { kind: "text", text: value.substring(TEXT_PREFIX.length) };
  }
  if (typeof value === "string" && value.startsWith(FILE_PREFIX)) {
    return { kind: "file", fileName: value.substring(FILE_PREFIX.length) };
  }
  throw new Error(`Unknown response definition ${value}`);
}

export function parseReplyRef(value: string): ReplyRef {
  if (typeof value !== "string") {
    throw new Error(`Rule must define "response" as a string, got ${JSON.stringify(value)}`);
  }
  if (value.startsWith(TEXT_PREFIX) || value.startsWith(FILE_PREFIX)) {
    return { kind: "inline", source: parsePayloadSource(value) };
  }
  const colonIndex = value.indexOf(":");
  if (colonIndex === -1) {
    return { kind: "template", templateName: value };
  }
  return { kind: "remoteTemplate", listenerName: value.substring(0, colonIndex), templateName: value.substring(colonIndex + 1) };
}

export function formatReplyRef(ref: ReplyRef): string {
  switch (ref.kind) {
    case "inline":
      return ref.source.kind === "text" ? TEXT_PREFIX + ref.source.text : FILE_PREFIX + ref.source.fileName;
    case "template":
      return ref.templateName;
    case "remoteTemplate":
      return `${ref.listenerName}:${ref.templateName}`;
  }
}

/**
 * The short form always replies without delay. The full form replies only when `sendResponse` is true.
 */
export function normalizeRule(match: string, raw: RawRule): Rule {
  if (typeof raw === "string") {
    return { match, reply: parseReplyRef(raw), delayMs: 0, replyEnabled: true };
  }
  return { match, reply: parseReplyRef(raw.response), delayMs: raw.delay || 0, replyEnabled: !!raw.sendResponse };
}

export function normalizeTemplate(name: string, raw: RawReplyTemplate): ReplyTemplate {
  return { name, source: parsePayloadSource(raw.content), processorName: raw.responseProcessor || undefined, targetTopic: raw.targetTopic };
}
