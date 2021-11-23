import { IRequestConfig, IResponseConfig } from "./interfaces";

export default class Memory {
    private memory: { [key: string]: IMemoryData[] } = {};

    public pushRequest(type: "kafka" | "http", endpoint: string, request: IRequestConfig, response: IResponseConfig): IMemoryData {
        if (!this.memory[endpoint]) {
            this.memory[endpoint] = [];
        }
        const memoryData: IMemoryData = {
            type,
            endpoint,
            request,
            response,
        };
        this.memory[endpoint].push(memoryData);
        return memoryData;
    }

    public getLastRequest(endpoint: string): IMemoryData {
        return this.memory[endpoint] && this.memory[endpoint][this.memory[endpoint].length - 1];
    }

    public getAllRequests() {
        return this.memory;
    }

    public clear(): void {
        this.memory = {};
    }
}

export interface IMemoryData {
    type: "kafka" | "http";
    endpoint: string;
    request: IRequestConfig;
    response: IResponseConfig;
}
