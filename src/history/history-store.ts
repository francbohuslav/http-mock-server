import type { InboundMessage, ListenerType, OutboundMessage } from "../messages";

export interface HistoryEntry {
  listenerType: ListenerType;
  /** HTTP URL including the query string, or `/<topic>` for brokers. */
  endpoint: string;
  inbound: InboundMessage;
  /** `null` until a broker reply is sent (or forever when no reply is configured). */
  outbound: OutboundMessage | null;
}

export const DEFAULT_HISTORY_LIMIT = 10;

/**
 * In-memory history of received messages grouped by endpoint. Each endpoint keeps at most `limit` newest entries.
 */
export class HistoryStore {
  private entries = new Map<string, HistoryEntry[]>();

  constructor(private limit = DEFAULT_HISTORY_LIMIT) {}

  public setLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`historyLimit must be a positive integer, got ${limit}`);
    }
    this.limit = limit;
    for (const list of this.entries.values()) {
      list.splice(0, Math.max(0, list.length - limit));
    }
  }

  public record(listenerType: ListenerType, endpoint: string, inbound: InboundMessage, outbound: OutboundMessage | null): HistoryEntry {
    const entry: HistoryEntry = { listenerType, endpoint, inbound, outbound };
    const list = this.entries.get(endpoint);
    if (list) {
      list.push(entry);
      if (list.length > this.limit) {
        list.shift();
      }
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
