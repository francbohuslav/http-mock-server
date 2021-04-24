import { IncomingMessage, OutgoingMessage } from "http";
import path from "path";
import fs from "fs";
import { IConfig, IResponseConfig } from "./interfaces";

export default class Requester {
    constructor(private configPath: string, private responsesFolder: string) {}

    public processResponse(request: IncomingMessage, requestBody: string, response: OutgoingMessage) {
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received ${request.method} request for ${request.url}`);
        console.log("");
        for (const header of Object.keys(request.headers)) {
            console.log(header + ": " + request.headers[header]);
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
        response.end(responseContent.body);
    }

    private getResponse(request: IncomingMessage): IResponseConfig {
        const config: IConfig = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
        for (const [mask, output] of Object.entries(config.requests)) {
            if (request.url.match(new RegExp(mask))) {
                if (output.startsWith("text:")) {
                    return this.getResponseFromText(output.substr(5));
                }
                if (output.startsWith("file:")) {
                    return this.parseResponseFile(path.join(this.responsesFolder, output.substr(5)), this.responsesFolder);
                }
                return { error: `Unknown request value in config for mask ${mask}` };
            }
        }
        return this.getResponseFromText("Unknown request");
    }

    private getResponseFromText(text: string): IResponseConfig {
        return {
            headers: {
                "Content-Type": "plain",
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
        return { headers, body: lines.slice(index + 1).join("\n") };
    }
}
