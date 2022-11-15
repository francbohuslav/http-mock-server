import { IConsole, IMessageBrokerResponseDefConfig, IResponseContent } from "../interfaces";
import { Responses } from "../responses";

export abstract class Listener {
  constructor(protected responses: Responses, protected console: IConsole) {}

  public abstract sendResponse(responseConfigDef: IMessageBrokerResponseDefConfig, responseContent: IResponseContent): Promise<void>;

  public printHeaders(headers: RawHeaders): void {
    if (Object.keys(headers).length) {
      this.console.log("");
      for (const header of Object.keys(headers)) {
        this.console.log(header + ": " + headers[header]);
      }
    }
  }
}

export type RawHeaders = { [key: string]: any };
export type StringHeaders = { [key: string]: string };
