export interface Logger {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export const SEPARATOR = "--------------------------------------------------------------------------------";

/**
 * Prints a message in the same layout for all listeners: separator, title, headers, empty line, body.
 */
export function logMessage(logger: Logger, title: string, headers: Record<string, unknown>, body: string): void {
  logger.log(`${SEPARATOR} ${new Date().toLocaleString()}`);
  logger.log(title);
  const names = Object.keys(headers);
  if (names.length) {
    logger.log("");
    for (const name of names) {
      logger.log(`${name}: ${headers[name]}`);
    }
  }
  logger.log("");
  logger.log(body || "{no body}");
  logger.log("");
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
