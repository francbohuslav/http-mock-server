export interface ParsedPayloadFile {
  headers: Record<string, string>;
  body: string;
  statusCode?: number;
  statusMessage?: string;
}

/**
 * Supported status line formats: `HTTP/1.1 200 text`, `HTTP 200 text`, `200 text`, `200`.
 */
const STATUS_LINE = /^(?:HTTP(?:\/\S+)?\s+)?(\d+)(?:\s+(.+))?$/;

/**
 * Parses a response file: optional status line, headers, an empty line, body.
 * Header lines are trimmed; body lines keep their whitespace, only CR of CRLF line endings is removed.
 * Invalid header lines are reported through `onWarning` and skipped.
 */
export function parsePayloadFile(text: string, onWarning: (message: string) => void): ParsedPayloadFile {
  const BYTE_ORDER_MARK = 0xfeff;
  const lines = (text.charCodeAt(0) === BYTE_ORDER_MARK ? text.substring(1) : text)
    .split("\n")
    .map((line) => line.replace(/\r$/, ""));
  const separatorIndex = lines.findIndex((line) => line.trim() === "");
  if (separatorIndex === -1) {
    throw new Error("Response file must contain headers, an empty line and a body");
  }

  const result: ParsedPayloadFile = { headers: {}, body: lines.slice(separatorIndex + 1).join("\n") };
  for (let i = 0; i < separatorIndex; i++) {
    const line = lines[i].trim();
    const colonIndex = line.indexOf(":");
    if (i === 0 && colonIndex === -1) {
      const statusMatch = line.match(STATUS_LINE);
      if (statusMatch) {
        result.statusCode = Number(statusMatch[1]);
        result.statusMessage = statusMatch[2]?.trim();
      } else {
        onWarning(`Line ${line} is not valid header`);
      }
      continue;
    }
    const name = colonIndex === -1 ? "" : line.substring(0, colonIndex).trim();
    if (!name) {
      onWarning(`Line ${line} is not valid header`);
      continue;
    }
    result.headers[name] = line.substring(colonIndex + 1).trim();
  }
  return result;
}
