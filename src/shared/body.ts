/**
 * Message body: a string for valid UTF-8 content (what processors usually work with), a Buffer for binary content.
 */
export type Body = string | Buffer;

const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * Decodes bytes as UTF-8 text; bytes that are not valid UTF-8 stay a Buffer.
 */
export function decodeBody(bytes: Uint8Array): Body {
  try {
    return utf8.decode(bytes);
  } catch {
    return Buffer.from(bytes);
  }
}

export function bodyToBuffer(body: Body): Buffer {
  return Buffer.isBuffer(body) ? body : Buffer.from(body);
}

export function describeBody(body: Body): string {
  if (Buffer.isBuffer(body)) {
    return `{binary body, ${body.length} bytes}`;
  }
  return body || "{no body}";
}

/**
 * JSON representation of a message for the History API: binary bodies are sent as base64 with `bodyEncoding: "base64"`.
 */
export function withJsonBody<T extends { body: Body }>(message: T): Omit<T, "body"> & { body: string; bodyEncoding?: "base64" } {
  if (Buffer.isBuffer(message.body)) {
    return { ...message, body: message.body.toString("base64"), bodyEncoding: "base64" };
  }
  return message as Omit<T, "body"> & { body: string };
}
