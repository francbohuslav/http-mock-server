import { IKafkaResponseDefConfig, IResponseContent } from "../interfaces";
import { Responses } from "../responses";

export abstract class Listener {
    constructor(protected responses: Responses) {}

    public abstract sendResponse(responseConfigDef: IKafkaResponseDefConfig, responseContent: IResponseContent): Promise<void>;

    public printHeaders(headers: RawHeaders): void {
        if (Object.keys(headers).length) {
            console.log("");
            for (const header of Object.keys(headers)) {
                console.log(header + ": " + headers[header]);
            }
        }
    }
}

export type RawHeaders = { [key: string]: any };
export type StringHeaders = { [key: string]: string };
