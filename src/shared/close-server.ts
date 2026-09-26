import type http from "node:http";

/**
 * Stops accepting connections and closes open keep-alive connections, so the returned promise does not wait for idle clients.
 * Resolves also when the server is not running.
 */
export function closeServer(server: http.Server | undefined): Promise<void> {
  if (!server?.listening) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}
