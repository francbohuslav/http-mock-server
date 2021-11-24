export interface IConfig {
    apiPort: string;
    listeners: {
        http: IHttpListenerConfig;
        kafka: { [name: string]: IKafkaListenerConfig };
    };
}

export interface IHttpListenerConfig {
    port: string;
    requests: { [key: string]: IRequestDefType };
}

export type IRequestDefType = IResponseContentDef | IRequestDefConfig;

export interface IKafkaListenerConfig {
    host: string;
    requests: { [topic: string]: IRequestDefConfig };
    responses: { [name: string]: IKafkaResponseDefConfig };
}

export interface IRequestDefConfig {
    response: string;
    delay: number;
    sendResponse: boolean;
}

export interface IKafkaResponseDefConfig {
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
export type IListenerType = "kafka" | "http";
