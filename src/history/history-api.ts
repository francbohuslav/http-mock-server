import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { HistoryEntry, HistoryStore } from "./history-store";

/**
 * JSON shape of one history record. It is a public contract used by clients and request-history.html.
 */
interface HistoryRecordJson {
  type: HistoryEntry["listenerType"];
  endpoint: string;
  request: HistoryEntry["inbound"];
  response: HistoryEntry["outbound"];
}

const GET_ALL_PREFIX = "/get-all-requests/";
const GET_LAST_PREFIX = "/get-last-request";
const CLEAR_PREFIX = "/clear-history/";

/**
 * Handler of the API server (`apiPort`): history as JSON and the history web page.
 */
export class HistoryApi {
  constructor(
    private readonly history: HistoryStore,
    private readonly historyPagePath: string
  ) {}

  public handle(request: IncomingMessage, response: ServerResponse): void {
    // The body is not used, it is only consumed
    request.resume();
    request.on("end", () => {
      const url = request.url || "/";
      response.setHeader("Server", "HttpMockServer");
      if (url.startsWith(GET_ALL_PREFIX)) {
        this.sendJson(response, this.allToJson());
      } else if (url.startsWith(`${GET_LAST_PREFIX}/`)) {
        // The endpoint keeps its leading slash: /get-last-request/test → /test
        const entry = this.history.last(url.substring(GET_LAST_PREFIX.length));
        this.sendJson(response, entry && toJson(entry));
      } else if (url.startsWith(CLEAR_PREFIX)) {
        this.history.clear();
        this.sendJson(response, "Memory cleared");
      } else {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(readFileSync(this.historyPagePath, "utf-8"));
      }
    });
  }

  private allToJson(): Record<string, HistoryRecordJson[]> {
    const result: Record<string, HistoryRecordJson[]> = {};
    for (const [endpoint, entries] of this.history.all()) {
      result[endpoint] = entries.map(toJson);
    }
    return result;
  }

  /**
   * `undefined` (unknown endpoint) produces an empty body.
   */
  private sendJson(response: ServerResponse, value: unknown): void {
    response.setHeader("Content-Type", "application/json");
    response.end(value === undefined ? "" : JSON.stringify(value, null, 2));
  }
}

function toJson(entry: HistoryEntry): HistoryRecordJson {
  return { type: entry.listenerType, endpoint: entry.endpoint, request: entry.inbound, response: entry.outbound };
}
