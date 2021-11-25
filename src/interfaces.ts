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
}

export type IRequestDefType = IResponseContentDef | IRequestDefConfig;

export interface IMessageBrokerListenerConfig {
    host: string;
    requests: { [topic: string]: IRequestDefConfig };
    responses: { [name: string]: IMessageBrokerResponseDefConfig };
    queueSettings: { [name: string]: any };
}

export interface IRequestDefConfig {
    response: string;
    delay: number;
    sendResponse: boolean;
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
