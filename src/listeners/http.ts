import http, { IncomingMessage, OutgoingMessage } from "http";
import { Configer } from "../configer";
import { delay } from "../core";
import { IHttpListenerConfig, IMessageBrokerResponseDefConfig, IRequestContent, IRequestDefConfig, IResponseContent, IResponseContentDef } from "../interfaces";
import Memory from "../memory";
import { Responses } from "../responses";
import { Listener } from "./listener";

export class HttpListener extends Listener {
    constructor(private config: IHttpListenerConfig, private configer: Configer, private memory: Memory, responses: Responses) {
        super(responses);
    }

    public listen(): HttpListener {
        console.log(`HTTP listener on port ${this.config.port}...`);
        const server = http.createServer(this.requestListener.bind(this));
        server.listen(this.config.port);
        return this;
    }

    private requestListener(request: IncomingMessage, response: OutgoingMessage) {
        let requestBody = "";
        request.on("data", (chunk) => (requestBody += chunk));
        request.on("end", async () => this.processRequest(request, requestBody, response));
    }

    private async processRequest(request: IncomingMessage, requestBody: string, response: OutgoingMessage): Promise<void> {
        const requestObject: IRequestContent = { time: new Date().toISOString(), headers: {}, body: requestBody };
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received ${request.method} request for ${request.url}`);
        requestObject.headers = request.headers;
        this.printHeaders(request.headers);
        console.log("");
        console.log(requestBody || "{no body}");
        console.log("");

        response.setHeader("Server", "HttpMockServer");
        response.setHeader("Content-Type", "text/plain");
        const requestDefConfig = this.getRequestDefConfig(request);

        let responseContent: IResponseContent;
        if (this.responses.isExternalResponse(requestDefConfig)) {
            responseContent = this.getResponseContentFromText(`Response will be sent by ${requestDefConfig.response}`);
        } else {
            responseContent = this.getResponseContent(requestDefConfig.response);
            if (requestDefConfig.delay) {
                await delay(requestDefConfig.delay);
            }
        }

        for (const header of Object.keys(responseContent.headers)) {
            response.setHeader(header, responseContent.headers[header]);
        }
        const memoryData = this.memory.pushRequest("http", request.url, requestObject, responseContent);
        response.end(responseContent.body);
        if (this.responses.isExternalResponse(requestDefConfig)) {
            this.responses.sendResponse("http", requestDefConfig, memoryData);
        }
    }

    private getRequestDefConfig(request: IncomingMessage): IRequestDefConfig {
        const config = this.configer.loadConfig();
        const httpConfig = config.listeners.http;
        for (const [mask, output] of Object.entries(httpConfig.requests)) {
            if (request.url.match(new RegExp(mask))) {
                return this.responses.getRequestDefConfig(output);
            }
        }
        throw new Error("Unknown request");
    }

    private getResponseContent(responseDef: IResponseContentDef): IResponseContent {
        if (responseDef.startsWith("text:")) {
            return this.getResponseContentFromText(responseDef.substr(5));
        }
        return this.responses.getResponseContent(responseDef);
    }

    private getResponseContentFromText(text: string): IResponseContent {
        const res = { ...this.responses.getResponseFromText(text) };
        res.headers["Content-Type"] = "text/plain";
        return res;
    }

    public sendResponse(responseConfigDef: IMessageBrokerResponseDefConfig, responseContent: IResponseContent): Promise<void> {
        throw new Error("Method not implemented.");
    }
}
