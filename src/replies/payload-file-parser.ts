import { type Body, decodeBody } from "../shared/body";

export interface ParsedPayloadFile {
  headers: Record<string, string>;
  body: Body;
  statusCode?: number;
  statusMessage?: string;
}

/**
 * Supported status line formats: `HTTP/1.1 200 text`, `HTTP 200 text`, `200 text`, `200`.
 */
const STATUS_LINE = /^(?:HTTP(?:\/\S+)?\s+)?(\d+)(?:\s+(.+))?$/;

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const LF = 0x0a;

/**
 * Parses a response file: optional status line, headers, an empty line, body.
 * Header lines are trimmed. A text (UTF-8) body keeps its whitespace, only CR of CRLF line endings is removed.
 * A binary body is returned as a Buffer byte for byte, so e.g. images can follow the header section.
 * Invalid header lines are reported through `onWarning` and skipped.
 */
export function parsePayloadFile(content: Buffer | string, onWarning: (message: string) => void): ParsedPayloadFile {
  let bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    bytes = bytes.subarray(UTF8_BOM.length);
  }

  const headerLines: string[] = [];
  let bodyStart = -1;
  for (let lineStart = 0; lineStart <= bytes.length; ) {
    const lineFeed = bytes.indexOf(LF, lineStart);
    const lineEnd = lineFeed === -1 ? bytes.length : lineFeed;
    const line = bytes.subarray(lineStart, lineEnd).toString("utf-8");
    const nextLineStart = lineEnd + 1;
    if (line.trim() === "") {
      bodyStart = Math.min(nextLineStart, bytes.length);
      break;
    }
    headerLines.push(line.trim());
    lineStart = nextLineStart;
  }
  if (bodyStart === -1) {
    throw new Error("Response file must contain headers, an empty line and a body");
  }

  const result: ParsedPayloadFile = { headers: {}, body: parseBody(bytes.subarray(bodyStart)) };
  headerLines.forEach((line, index) => {
    const colonIndex = line.indexOf(":");
    if (index === 0 && colonIndex === -1) {
      const statusMatch = line.match(STATUS_LINE);
      if (statusMatch) {
        result.statusCode = Number(statusMatch[1]);
        result.statusMessage = statusMatch[2]?.trim();
      } else {
        onWarning(`Line ${line} is not valid header`);
      }
      return;
    }
    const name = colonIndex === -1 ? "" : line.substring(0, colonIndex).trim();
    if (!name) {
      onWarning(`Line ${line} is not valid header`);
      return;
    }
    result.headers[name] = line.substring(colonIndex + 1).trim();
  });
  return result;
}

function parseBody(bytes: Buffer): Body {
  const body = decodeBody(bytes);
  if (Buffer.isBuffer(body)) {
    return body;
  }
  return body
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .join("\n");
}
