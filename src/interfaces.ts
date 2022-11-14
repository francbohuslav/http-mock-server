import { IncomingHttpHeaders } from "http";

export interface IConfig {
  apiPort: string;
  listeners: {
    http: IHttpListenerConfig;
    kafka: { [name: string]: IMessageBrokerListenerConfig };
    amqp: { [name: string]: IMessageBrokerListenerConfig };
  };
}

export interface IHttpListenerConfig {
  port: string;
  requests: { [key: string]: IRequestDefType };
  responses: { [name: string]: IHttpResponseDefConfig };
}

export type IRequestDefType = IResponseContentDef | IRequestDefConfig;

export interface IMessageBrokerListenerConfig {
  host: string;
  requests: { [topic: string]: IRequestDefConfig };
  responses: { [name: string]: IMessageBrokerResponseDefConfig };
  queueSettings: { [name: string]: any };
}

export interface IRequestDefConfig {
  /**
   * text:something or file:response.txt
   */
  response: string;
  delay: number;
  sendResponse: boolean;
}

export interface IHttpResponseDefConfig {
  content: IResponseContentDef;
  responseProcessor: string;
}

export interface IMessageBrokerResponseDefConfig {
  content: IResponseContentDef;
  targetTopic: string;
  responseProcessor: string;
}

export interface IRequestContent {
  time: string;
  headers?: { [name: string]: any };
  body?: string;
}

export interface IResponseContent extends IRequestContent {
  error?: string;
}

export type IResponseContentDef = string;
export type IListenerType = "kafka" | "http" | "amqp";

// To mock incomingMessage
export interface IIncomingMessage {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
}

export interface IOutgoingMessage {
  setHeader(key: string, value: string): void;
  end(content: string): void;
}

export interface IConsole {
  log(...attrs: any[]): void;
}
