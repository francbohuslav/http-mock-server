import type { InboundMessage, ListenerType, OutboundMessage } from "../messages";

export interface HistoryEntry {
  listenerType: ListenerType;
  /** HTTP URL including the query string, or `/<topic>` for brokers. */
  endpoint: string;
  inbound: InboundMessage;
  /** `null` until a broker reply is sent (or forever when no reply is configured). */
  outbound: OutboundMessage | null;
}

/**
 * In-memory history of received messages grouped by endpoint.
 */
export class HistoryStore {
  private entries = new Map<string, HistoryEntry[]>();

  public record(listenerType: ListenerType, endpoint: string, inbound: InboundMessage, outbound: OutboundMessage | null): HistoryEntry {
    const entry: HistoryEntry = { listenerType, endpoint, inbound, outbound };
    const list = this.entries.get(endpoint);
    if (list) {
      list.push(entry);
    } else {
      this.entries.set(endpoint, [entry]);
    }
    return entry;
  }

  public last(endpoint: string): HistoryEntry | undefined {
    const list = this.entries.get(endpoint);
    return list?.[list.length - 1];
  }

  public all(): ReadonlyMap<string, HistoryEntry[]> {
    return this.entries;
  }

  public clear(): void {
    this.entries = new Map();
  }
}
