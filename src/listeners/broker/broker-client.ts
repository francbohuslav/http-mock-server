import { RawBrokerListenerConfig } from "../../config/raw-config";

export type BrokerType = "kafka" | "amqp";

export interface BrokerMessage {
  headers: Record<string, unknown>;
  body: string;
}

export type BrokerMessageHandler = (topic: string, message: BrokerMessage) => Promise<void>;

/**
 * Thin adapter over a message broker library. Everything mock specific lives in BrokerListener, so tests can use a fake client.
 */
export interface BrokerClient {
  connect(): Promise<void>;
  subscribe(topics: string[], handler: BrokerMessageHandler): Promise<void>;
  publish(topic: string, message: BrokerMessage): Promise<void>;
  close(): Promise<void>;
}

export type BrokerClientFactory = (type: BrokerType, config: RawBrokerListenerConfig) => BrokerClient;
