export interface IConfig {
    port:string,
    apiPort:string,
    requests: { [key: string]: string };
}

export interface IRequestConfig {
    headers?: { [name: string]: string };
    body?: string;
}

export interface IResponseConfig extends IRequestConfig {
    error?: string;
}
