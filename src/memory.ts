import { IRequestConfig, IResponseConfig } from "./interfaces";

export default class Memory {
    private memory: { [key: string]: IMemoryData[] } = {};

    public pushRequest(requestUrl: string, request: IRequestConfig, response: IResponseConfig): void {
        if (!this.memory[requestUrl]) {
            this.memory[requestUrl] = [];
        }
        this.memory[requestUrl].push({
            time: new Date().toISOString(),
            url: requestUrl,
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
    time:string;
    url: string;
    request: IRequestConfig;
    response: IResponseConfig;
}
