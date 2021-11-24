import { IListenerType, IRequestContent, IResponseContent } from "./interfaces";

export default class Memory {
    private memory: { [key: string]: IMemoryData[] } = {};

    public pushRequest(type: IListenerType, endpoint: string, request: IRequestContent, response: IResponseContent): IMemoryData {
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
    type: IListenerType;
    endpoint: string;
    request: IRequestContent;
    response: IResponseContent;
}
