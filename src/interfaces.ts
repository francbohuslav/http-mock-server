export interface IConfig {
    port:string,
    requests: { [key: string]: string };
}

export interface IResponseConfig {
    error?: string;
    headers?: { [name: string]: string };
    body?: string;
}
