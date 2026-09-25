import fs from "fs";
import os from "os";
import path from "path";
import { MockServerApp, StartedPorts } from "../../src/app";
import { Logger } from "../../src/shared/logger";
import { FakeBrokerNetwork } from "./fake-broker-client";
import { copyDirectory, sendRequest } from "./mock-server-process";

export class CapturingLogger implements Logger {
  public readonly lines: string[] = [];
  public readonly errors: string[] = [];

  public log(...args: unknown[]): void {
    this.lines.push(args.map(String).join(" "));
  }

  public error(...args: unknown[]): void {
    this.errors.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "));
  }
}

/**
 * Mock server running inside the test process with fake broker clients and random ports.
 */
export class InProcessApp {
  public readonly network = new FakeBrokerNetwork();
  public readonly logger = new CapturingLogger();
  public readonly app: MockServerApp;
  public ports?: StartedPorts;

  constructor(
    public readonly rootDir: string,
    config: object
  ) {
    fs.writeFileSync(path.join(rootDir, "config.jsonc"), JSON.stringify(config, null, 2));
    this.app = new MockServerApp({
      rootDir,
      historyPagePath: path.join(__dirname, "..", "..", "request-history.html"),
      logger: this.logger,
      brokerClientFactory: this.network.factory,
      ports: { api: 0, http: 0 },
    });
  }

  public static create(config: object, fixtureDir: string): InProcessApp {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "http-mock-server-app-"));
    copyDirectory(fixtureDir, rootDir);
    return new InProcessApp(rootDir, config);
  }

  public async start(): Promise<this> {
    this.ports = await this.app.start();
    return this;
  }

  public async stop(): Promise<void> {
    await this.app.stop();
    fs.rmSync(this.rootDir, { recursive: true, force: true });
  }

  public http(urlPath: string) {
    if (!this.ports?.httpPort) {
      throw new Error("HTTP listener is not running");
    }
    return sendRequest(this.ports.httpPort, urlPath);
  }

  public async apiJson(urlPath: string): Promise<any> {
    if (!this.ports) {
      throw new Error("App is not started");
    }
    const result = await sendRequest(this.ports.apiPort, urlPath);
    return result.body === "" ? undefined : JSON.parse(result.body);
  }
}

export async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error("Condition not met in time");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
