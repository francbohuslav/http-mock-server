import fs from "fs";
import { join } from "path";
import { Configer } from "./configer";
import { delay } from "./core";
import { IRequestContent, IRequestDefConfig, IRequestDefType, IResponseContent, IResponseContentDef } from "./interfaces";
import { Listener } from "./listeners/listener";
import { IMemoryData } from "./memory";

export class Responses {
  private listeners: { [key: string]: Listener } = {};

  constructor(private defaultResponseLocation: string, private configer: Configer, protected responseProcessors: any) {}

  public registerListener(name: string, listener: Listener) {
    if (this.listeners[name]) {
      throw new Error(`Listener ${name} already registered. Name must be unique across whole config.`);
    }
    this.listeners[name] = listener;
  }

  public getRequestDefConfig(requestDef: IRequestDefType): IRequestDefConfig {
    if (typeof requestDef == "string") {
      return {
        delay: 0,
        response: requestDef,
        sendResponse: true,
      };
    } else {
      return requestDef as IRequestDefConfig;
    }
  }

  public isExternalResponse(requestDefConfig: IRequestDefConfig): boolean {
    if (requestDefConfig.response.startsWith("text:")) {
      return false;
    }
    if (requestDefConfig.response.startsWith("file:")) {
      return false;
    }
    if (requestDefConfig.response.includes(":")) {
      return true;
    }
  }

  public getResponseContent(requestDef: IResponseContentDef): IResponseContent {
    if (typeof requestDef == "string") {
      if (requestDef.startsWith("text:")) {
        return this.getResponseFromText(requestDef.substring(5));
      }
      if (requestDef.startsWith("file:")) {
        return this.parseResponseFile(requestDef.substring(5));
      }
      throw new Error(`Unknown response definition ${requestDef}`);
    }
  }

  public async sendResponse(sourceName: string, requestDefConfig: IRequestDefConfig, memoryData: IMemoryData): Promise<void> {
    if (requestDefConfig.delay) {
      await delay(requestDefConfig.delay);
    }
    const match = requestDefConfig.response.match(/^(.*?):(.*?)$/);
    const targetName = requestDefConfig.response.includes(":") ? match[1] : sourceName;
    const responseName = requestDefConfig.response.includes(":") ? match[2] : requestDefConfig.response;
    const config = this.configer.loadConfig();
    const mbListenConfig = (config.listeners.kafka && config.listeners.kafka[targetName]) || (config.listeners.amqp && config.listeners.amqp[targetName]);
    const responseConfigDef = mbListenConfig.responses[responseName];

    if (!responseConfigDef) {
      throw new Error(`Unknown response "${responseName}" for listener ${targetName}`);
    }
    const responseContent = this.getResponseContent(responseConfigDef.content);
    if (responseConfigDef.responseProcessor) {
      await this.runResponseProcessor(responseConfigDef.responseProcessor, memoryData.request, responseContent);
    }
    responseContent.time = new Date().toISOString();
    memoryData.response = responseContent;

    await this.listeners[targetName].sendResponse(responseConfigDef, responseContent);
  }

  public getResponseFromText(text: string): IResponseContent {
    return {
      time: new Date().toISOString(),
      headers: {},
      body: text,
    };
  }

  private parseResponseFile(responseFile: string): IResponseContent {
    responseFile = join(this.defaultResponseLocation, responseFile);
    const lines = fs
      .readFileSync(responseFile, "utf-8")
      .split("\n")
      .map((l) => l.trim());
    const index = lines.indexOf("");
    if (index == -1) {
      console.error(`Response file must contains header, empty line, body. Inspire from file ${this.defaultResponseLocation}`);
      process.exit(1);
    }
    const headers: { [name: string]: string } = {};
    let statusCode: number | undefined;
    let statusMessage: string | undefined;
    for (let i = 0; i < index; i++) {
      if (i == 0 && !lines[i].includes(":")) {
        // Supported status line formats:
        // - HTTP/1.1 200 text
        // - HTTP 200 text
        // - 200 text
        // - 200
        const statusMatch = lines[i].match(/^(?:HTTP(?:\/\S+)?\s+)?(\d+)(?:\s+(.+))?$/);
        if (!statusMatch) {
          console.error(`Line ${lines[i]} is not valid header`);
        } else {
          statusCode = Number(statusMatch[1]);
          statusMessage = statusMatch[2]?.trim();
        }
        continue;
      }
      const match = lines[i].match(/^(.*):(.*)$/);
      if (!match) {
        console.error(`Line ${lines[i]} is not valid header`);
      } else {
        headers[match[1].trim()] = match[2].trim();
      }
    }
    return {
      time: new Date().toISOString(),
      headers,
      body: lines.slice(index + 1).join("\n"),
      statusCode,
      statusMessage,
    };
  }

  /**
   * Runs the processor and waits for it when it returns a Promise. The return value is ignored, the processor mutates responseContent.
   */
  public async runResponseProcessor(responseProcessor: string, requestContent: IRequestContent, responseContent: IResponseContent): Promise<void> {
    if (!responseProcessor) {
      throw new Error("ResponseProcessor is empty");
    }
    if (!this.responseProcessors[responseProcessor]) {
      throw new Error(`ResponseProcessor ${responseProcessor} is not in function(requestContent, responseContent) in file processors.js.`);
    }
    await this.responseProcessors[responseProcessor](requestContent, responseContent);
  }
}
