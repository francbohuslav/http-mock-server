import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { ConfigProvider } from "./config/config-provider";
import type { RawBrokerListenerConfig } from "./config/raw-config";
import { HistoryApi } from "./history/history-api";
import { DEFAULT_HISTORY_LIMIT, HistoryStore } from "./history/history-store";
import { AmqpClient } from "./listeners/broker/amqp-client";
import type { BrokerClientFactory, BrokerType } from "./listeners/broker/broker-client";
import { BrokerListener } from "./listeners/broker/broker-listener";
import { BrokerRegistry } from "./listeners/broker/broker-registry";
import { BrokerReplyDispatcher } from "./listeners/broker/broker-reply-dispatcher";
import { KafkaClient } from "./listeners/broker/kafka-client";
import { HttpListener } from "./listeners/http-listener";
import { PayloadLoader } from "./replies/payload-loader";
import { ProcessorRegistry } from "./replies/processor-registry";
import { ReplyBuilder } from "./replies/reply-builder";
import { closeServer } from "./shared/close-server";
import type { Logger } from "./shared/logger";

export interface AppOptions {
  /** Directory with config.jsonc and responses/. */
  rootDir: string;
  historyPagePath: string;
  logger?: Logger;
  brokerClientFactory?: BrokerClientFactory;
  /** Overrides ports from the config, 0 = random port (tests). */
  ports?: { api?: number; http?: number };
}

export interface StartedPorts {
  apiPort: number;
  httpPort?: number;
}

export const defaultBrokerClientFactory: BrokerClientFactory = (type, config, logger) =>
  type === "kafka" ? new KafkaClient(config.host) : new AmqpClient(config.host, config.queueSettings, logger);

/**
 * Composition root: wires all parts together and starts the API server and the listeners.
 */
export class MockServerApp {
  public readonly history = new HistoryStore();
  public readonly brokers = new BrokerRegistry();
  private readonly logger: Logger;
  private readonly configProvider: ConfigProvider;
  private apiServer?: http.Server;
  private httpListener?: HttpListener;
  private stopping?: Promise<void>;

  constructor(private readonly options: AppOptions) {
    this.logger = options.logger || console;
    this.configProvider = new ConfigProvider(path.join(options.rootDir, "config.jsonc"));
  }

  public async start(): Promise<StartedPorts> {
    const config = this.configProvider.load();
    this.history.setLimit(config.historyLimit ?? DEFAULT_HISTORY_LIMIT);
    for (const warning of this.configProvider.validate(config)) {
      this.logger.error(`Config warning: ${warning}`);
    }
    const responsesDir = path.join(this.options.rootDir, "responses");
    const processors = ProcessorRegistry.load(path.join(responsesDir, "processors.js"));
    const loader = new PayloadLoader(responsesDir, this.logger);
    const brokerBuilder = new ReplyBuilder(loader, processors, {});
    const dispatcher = new BrokerReplyDispatcher(this.configProvider, this.brokers, brokerBuilder);

    const apiPort = await this.startApi(this.options.ports?.api ?? config.apiPort);
    const result: StartedPorts = { apiPort };

    const httpConfig = config.listeners.http;
    if (httpConfig && httpConfig.enabled !== false) {
      const httpBuilder = new ReplyBuilder(loader, processors, { "Content-Type": "text/plain" });
      this.httpListener = new HttpListener(this.configProvider, httpBuilder, dispatcher, this.history, this.logger);
      result.httpPort = await this.httpListener.listen(this.options.ports?.http ?? httpConfig.port);
    }

    const brokerClientFactory = this.options.brokerClientFactory || defaultBrokerClientFactory;
    for (const type of ["kafka", "amqp"] as BrokerType[]) {
      for (const [name, brokerConfig] of Object.entries<RawBrokerListenerConfig>(config.listeners[type] || {})) {
        if (brokerConfig.enabled === false) {
          continue;
        }
        const client = brokerClientFactory(type, brokerConfig, this.logger);
        this.brokers.register(new BrokerListener(name, type, brokerConfig, client, this.history, dispatcher, this.logger));
      }
    }
    await Promise.all(this.brokers.all().map((listener) => listener.start()));
    return result;
  }

  /**
   * Stops brokers and HTTP servers. Calling it again returns the same promise.
   */
  public stop(): Promise<void> {
    this.stopping ??= (async () => {
      await Promise.allSettled(this.brokers.all().map((listener) => listener.stop()));
      await this.httpListener?.close();
      await closeServer(this.apiServer);
    })();
    return this.stopping;
  }

  private startApi(port: number): Promise<number> {
    this.logger.log(`API is listening on port ${port}...`);
    const api = new HistoryApi(this.history, this.options.historyPagePath);
    const server = http.createServer((request, response) => api.handle(request, response));
    this.apiServer = server;
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, () => resolve((server.address() as AddressInfo).port));
    });
  }
}
