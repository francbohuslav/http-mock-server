import fs from "fs";
import http, { IncomingMessage, OutgoingMessage } from "http";
import { IConfig, IHttpListenerConfig, IRequestConfig, IResponseConfig } from "../interfaces";
import Memory from "../memory";
import { Responses } from "../responses";
import { Listener } from "./listener";

export class HttpListener extends Listener {
    constructor(
        private config: IHttpListenerConfig,
        private configPath: string,
        private memory: Memory,
        private responses: Responses,
        responseProcessors: any
    ) {
        super(responseProcessors);
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
        request.on("end", () => this.processRequest(request, requestBody, response));
    }

    private processRequest(request: IncomingMessage, requestBody: string, response: OutgoingMessage) {
        const requestObject: IRequestConfig = { time: new Date().toISOString(), headers: {}, body: requestBody };
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received ${request.method} request for ${request.url}`);
        requestObject.headers = this.printHeaders(request.headers);
        console.log("");
        console.log(requestBody || "{no body}");
        console.log("");

        response.setHeader("Server", "HttpMockServer");
        response.setHeader("Content-Type", "text/plain");
        const responseContent = this.getResponse(request);
        for (const header of Object.keys(responseContent.headers)) {
            response.setHeader(header, responseContent.headers[header]);
        }
        this.memory.pushRequest("http", request.url, requestObject, responseContent);
        response.end(responseContent.body);
    }

    private getResponse(request: IncomingMessage): IResponseConfig {
        const config: IConfig = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
        const httpConfig = config.listeners.http;
        for (const [mask, output] of Object.entries(httpConfig.requests)) {
            if (request.url.match(new RegExp(mask))) {
                if (output.startsWith("text:")) {
                    return this.getResponseFromText(output.substr(5));
                }
                if (output.startsWith("file:")) {
                    return this.responses.parseResponseFile(output.substr(5));
                }
                return { time: new Date().toISOString(), error: `Unknown request value in config for mask ${mask}` };
            }
        }
        return this.getResponseFromText("Unknown request");
    }

    private getResponseFromText(text: string): IResponseConfig {
        const res = { ...this.responses.getResponseFromText(text) };
        res.headers["Content-Type"] = "text/plain";
        return res;
    }
}
