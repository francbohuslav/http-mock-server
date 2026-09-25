import type { BrokerListener } from "./broker-listener";

/**
 * Running broker listeners by name. Names are unique across Kafka and AMQP.
 */
export class BrokerRegistry {
  private readonly listeners = new Map<string, BrokerListener>();

  public register(listener: BrokerListener): void {
    if (this.listeners.has(listener.name)) {
      throw new Error(`Listener ${listener.name} already registered. Name must be unique across whole config.`);
    }
    this.listeners.set(listener.name, listener);
  }

  public get(name: string): BrokerListener | undefined {
    return this.listeners.get(name);
  }

  public all(): BrokerListener[] {
    return [...this.listeners.values()];
  }
}
