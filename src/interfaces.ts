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
    queues: { [key: string]: IKafkaQueueConfig };
}

export interface IKafkaQueueConfig {
    response: string;
    delay: number;
    sendResponse: boolean;
}

export interface IRequestConfig {
    time: string;
    headers?: { [name: string]: string };
    body?: string;
}

export interface IResponseConfig extends IRequestConfig {
    error?: string;
}
