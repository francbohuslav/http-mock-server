import { IRequestConfig, IResponseConfig } from "./interfaces";

export default class Memory {
    private memory: { [key: string]: IMemoryData[] } = {};

    public pushRequest(type: "kafka" | "http", endpoint: string, request: IRequestConfig, response: IResponseConfig): void {
        if (!this.memory[endpoint]) {
            this.memory[endpoint] = [];
        }
        this.memory[endpoint].push({
            type,
            endpoint,
            request,
            response,
        });
    }

    public getLastRequest(requestUrl: string): IMemoryData {
        return this.memory[requestUrl] && this.memory[requestUrl][this.memory[requestUrl].length - 1];
    }

    public getAllRequests() {
        return this.memory;
    }

    public clear(): void {
        this.memory = {};
    }
}

interface IMemoryData {
    type: "kafka" | "http";
    endpoint: string;
    request: IRequestConfig;
    response: IResponseConfig;
}
