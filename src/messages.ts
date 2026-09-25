export type ListenerType = "http" | "kafka" | "amqp";

/**
 * A message received by a listener: an HTTP request or a Kafka/AMQP message.
 * Response processors receive it as their first argument (`requestContent`).
 */
export interface InboundMessage {
  time: string;
  /** HTTP URL including the query string, or the topic/queue name for brokers. */
  url: string;
  headers: Record<string, unknown>;
  body: string;
}

/**
 * A message sent back by the mock: an HTTP response or a Kafka/AMQP message.
 * Response processors receive it as their second argument (`responseContent`) and mutate it.
 */
export interface OutboundMessage {
  time: string;
  headers: Record<string, unknown>;
  body: string;
  /** HTTP only. */
  statusCode?: number;
  /** HTTP only. */
  statusMessage?: string;
  /** Set when the mock failed to build the reply. */
  error?: string;
}

export function now(): string {
  return new Date().toISOString();
}
