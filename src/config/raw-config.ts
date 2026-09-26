/**
 * Types of config.jsonc exactly as written by the user. Key names are part of the public contract and must not change.
 * The rest of the application works with the normalized types from `normalize.ts`.
 */
export interface RawConfig {
  apiPort: number;
  /** Entries kept per endpoint in history, default 10. */
  historyLimit?: number;
  listeners: {
    http?: RawHttpListenerConfig;
    kafka?: Record<string, RawBrokerListenerConfig>;
    amqp?: Record<string, RawBrokerListenerConfig>;
  };
}

export interface RawHttpListenerConfig {
  enabled?: boolean;
  port: number;
  /** URL regex → rule. */
  requests: Record<string, RawRule>;
  /** Template name → template. */
  responses?: Record<string, RawReplyTemplate>;
}

export interface RawBrokerListenerConfig {
  enabled?: boolean;
  host: string;
  /** Topic/queue → rule. */
  requests?: Record<string, RawRule>;
  /** Template name → template. */
  responses?: Record<string, RawReplyTemplate>;
  /** AMQP only: queue regex → amqplib assertQueue options. */
  queueSettings?: Record<string, object>;
}

/**
 * Short form: the reply reference itself. Full form: an object.
 */
export type RawRule = string | RawRuleObject;

export interface RawRuleObject {
  /** Reply reference: `text:…`, `file:…`, `<template>` or `<listener>:<template>`. */
  response: string;
  delay?: number;
  sendResponse?: boolean;
}

export interface RawReplyTemplate {
  /** Payload source: `text:…` or `file:…`. */
  content: string;
  responseProcessor?: string;
  /** Brokers only. */
  targetTopic?: string;
}
