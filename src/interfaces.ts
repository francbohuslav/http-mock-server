export interface IConfig {
    apiPort: string;
    listeners: {
        http: IHttpListenerConfig;
        kafka: IKafkaListenerConfig[];
    };
}

export interface IHttpListenerConfig {
    port: string;
    requests: { [key: string]: string };
}

export interface IKafkaListenerConfig {
    host: string;
    topics: { [key: string]: IKafkaTopicConfig };
}

export interface IKafkaTopicConfig {
    response: string;
    delay: number;
    sendResponse: boolean;
    targetTopic: string;
    responseProcessor: string;
}

export interface IRequestConfig {
    time: string;
    headers?: { [name: string]: any };
    body?: string;
}

export interface IResponseConfig extends IRequestConfig {
    error?: string;
}
