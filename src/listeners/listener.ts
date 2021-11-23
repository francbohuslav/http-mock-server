import { IRequestConfig, IResponseConfig } from "../interfaces";

export abstract class Listener {
    constructor(protected responseProcessors: any) {}

    public printHeaders(headers: RawHeaders): StringHeaders {
        const res: StringHeaders = {};
        if (Object.keys(headers).length) {
            console.log("");
            for (const header of Object.keys(headers)) {
                console.log(header + ": " + headers[header]);
                res[header] = headers[header].toString();
            }
        }
        return res;
    }

    protected runResponseProcessor(responseProcessor: string, requestConfig: IRequestConfig, responseConfig: IResponseConfig) {
        if (!responseProcessor) {
            throw new Error("PesponseProcessor is empty");
        }
        if (!this.responseProcessors[responseProcessor]) {
            throw new Error(`PesponseProcessor ${responseProcessor} is not in object in file processors.js.`);
        }
        return this.responseProcessors[responseProcessor](requestConfig, responseConfig);
    }
}

export type RawHeaders = { [key: string]: any };
export type StringHeaders = { [key: string]: string };
