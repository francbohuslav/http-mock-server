import http, { IncomingMessage, OutgoingMessage, ServerResponse } from "http";
import { Configer } from "../configer";
import { delay } from "../core";
import {
  IConsole,
  IHttpListenerConfig,
  IIncomingMessage,
  IMessageBrokerResponseDefConfig,
  IOutgoingMessage,
  IRequestContent,
  IRequestDefConfig,
  IResponseContent,
  IResponseContentDef,
} from "../interfaces";
import Memory from "../memory";
import { Responses } from "../responses";
import { Listener } from "./listener";

export class HttpListener extends Listener {
  constructor(
    private config: IHttpListenerConfig,
    private configer: Configer,
    private memory: Memory,
    responses: Responses,
    console: IConsole
  ) {
    super(responses, console);
  }

  public listen(): HttpListener {
    this.console.log(`HTTP listener on port ${this.config.port}...`);
    const server = http.createServer(this.requestListener.bind(this));
    server.listen(this.config.port);
    return this;
  }

  private requestListener(request: IncomingMessage, response: ServerResponse) {
    this.setCorsHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    let requestBody = "";
    request.on("data", (chunk) => (requestBody += chunk));
    request.on("end", async () =>
      this.processRequest(request, requestBody, response)
    );
  }

  private setCorsHeaders(response: OutgoingMessage) {
    // Can be tested from console by: fetch("http://localhost:4444/").then(data=> {console.log(data); return data.text()}).then(data=>console.log("Response: "+data))
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "*");
    response.setHeader("Access-Control-Allow-Headers", "*");
  }

  protected async processRequest(
    request: IIncomingMessage,
    requestBody: string,
    response: IOutgoingMessage
  ): Promise<void> {
    const requestObject: IRequestContent = {
      time: new Date().toISOString(),
      url: request.url,
      headers: {},
      body: requestBody,
    };
    this.console.log(
      `-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`
    );
    this.console.log(`Received ${request.method} request for ${request.url}`);
    requestObject.headers = request.headers;
    this.printHeaders(request.headers);
    this.console.log("");
    this.console.log(requestBody || "{no body}");
    this.console.log("");

    response.setHeader("Server", "HttpMockServer");
    response.setHeader("Content-Type", "text/plain");

    let requestDefConfig: IRequestDefConfig | undefined;
    let responseContent: IResponseContent;
    try {
      requestDefConfig = this.getRequestDefConfig(request);
      responseContent = await this.buildResponseContent(
        requestDefConfig,
        requestObject
      );
    } catch (error) {
      // Answers with 500 instead of leaving the client hanging and crashing the process on unhandled rejection
      this.console.log(`Error while processing request ${request.url}`, error);
      requestDefConfig = undefined;
      responseContent = this.getResponseContentFromText(
        `Mock server error: ${error instanceof Error ? error.message : error}`
      );
      responseContent.statusCode = 500;
      responseContent.error = String(error);
    }
    responseContent.time = new Date().toISOString();

    for (const header of Object.keys(responseContent.headers)) {
      response.setHeader(header, responseContent.headers[header]);
    }
    if (responseContent.statusCode != undefined) {
      response.statusCode = responseContent.statusCode;
    }
    if (responseContent.statusMessage) {
      response.statusMessage = responseContent.statusMessage;
    }
    const memoryData = this.memory.pushRequest(
      "http",
      request.url,
      requestObject,
      responseContent
    );
    response.end(responseContent.body);
    const externalRequestDefConfig = requestDefConfig;
    if (
      externalRequestDefConfig &&
      this.responses.isExternalResponse(externalRequestDefConfig)
    ) {
      this.responses
        .sendResponse("http", externalRequestDefConfig, memoryData)
        .catch((error) =>
          this.console.log(
            `Error while sending response ${externalRequestDefConfig.response}`,
            error
          )
        );
    }
  }

  private async buildResponseContent(
    requestDefConfig: IRequestDefConfig,
    requestObject: IRequestContent
  ): Promise<IResponseContent> {
    if (this.responses.isExternalResponse(requestDefConfig)) {
      return this.getResponseContentFromText(
        `Response will be sent by ${requestDefConfig.response}`
      );
    }
    let responseContent: IResponseContent;
    if (!requestDefConfig.response.includes(":")) {
      const responseConfigDef =
        this.config.responses[requestDefConfig.response];
      if (!responseConfigDef) {
        throw new Error(`Unknown response "${requestDefConfig.response}"`);
      }
      responseContent = this.getResponseContent(responseConfigDef.content);
      if (responseConfigDef.responseProcessor) {
        await this.responses.runResponseProcessor(
          responseConfigDef.responseProcessor,
          requestObject,
          responseContent
        );
      }
    } else {
      responseContent = this.getResponseContent(requestDefConfig.response);
    }
    if (requestDefConfig.delay) {
      await delay(requestDefConfig.delay);
    }
    return responseContent;
  }

  private getRequestDefConfig(request: IIncomingMessage): IRequestDefConfig {
    const config = this.configer.loadConfig();
    const httpConfig = config.listeners.http;
    for (const [mask, output] of Object.entries(httpConfig.requests)) {
      if (request.url.match(new RegExp(mask))) {
        return this.responses.getRequestDefConfig(output);
      }
    }
    throw new Error("Unknown request");
  }

  private getResponseContent(
    responseDef: IResponseContentDef
  ): IResponseContent {
    if (responseDef.startsWith("text:")) {
      return this.getResponseContentFromText(responseDef.substring(5));
    }
    return this.responses.getResponseContent(responseDef);
  }

  private getResponseContentFromText(text: string): IResponseContent {
    const res = { ...this.responses.getResponseFromText(text) };
    res.headers["Content-Type"] = "text/plain";
    return res;
  }

  public sendResponse(
    _responseConfigDef: IMessageBrokerResponseDefConfig,
    _responseContent: IResponseContent
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
