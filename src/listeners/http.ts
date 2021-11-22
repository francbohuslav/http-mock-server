import fs from "fs";
import http, { IncomingMessage, OutgoingMessage } from "http";
import path from "path";
import { IConfig, IHttpListenerConfig, IRequestConfig, IResponseConfig } from "../interfaces";
import Memory from "../memory";

export class HttpListener {
    constructor(private config: IHttpListenerConfig, private configPath: string, private responsesDirectory: string, private memory: Memory) {}

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
        console.log("");
        for (const header of Object.keys(request.headers)) {
            console.log(header + ": " + request.headers[header]);
            requestObject.headers[header] = request.headers[header].toString();
        }
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
                    return this.parseResponseFile(path.join(this.responsesDirectory, output.substr(5)), this.responsesDirectory);
                }
                return { time: new Date().toISOString(), error: `Unknown request value in config for mask ${mask}` };
            }
        }
        return this.getResponseFromText("Unknown request");
    }

    private getResponseFromText(text: string): IResponseConfig {
        return {
            time: new Date().toISOString(),
            headers: {
                "Content-Type": "text/plain",
            },
            body: text,
        };
    }

    private parseResponseFile(responseFile: string, defaultResponseLocation: string): IResponseConfig {
        const lines = fs
            .readFileSync(responseFile, "utf-8")
            .split("\n")
            .map((l) => l.trim());
        const index = lines.indexOf("");
        if (index == -1) {
            console.error(`Response file must contains header, empty line, body. Inspire from file ${defaultResponseLocation}`);
            process.exit(1);
        }
        const headers: { [name: string]: string } = {};
        for (let i = 0; i < index; i++) {
            const match = lines[i].match(/^(.*):(.*)$/);
            if (!match) {
                console.error(`Line ${lines[i]} is not valid header`);
            } else {
                headers[match[1].trim()] = match[2].trim();
            }
        }
        return { time: new Date().toISOString(), headers, body: lines.slice(index + 1).join("\n") };
    }
}
