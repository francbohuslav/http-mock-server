import { IncomingMessage, OutgoingMessage } from "node:http";
import path from "path";
import http from "http";
import Requester from "./requester";
import Memory from "./memory";
import { IConfig } from "./interfaces";

const configPath = path.join(__dirname, "..", "config.json");
const configForListen: IConfig = require(configPath);
const memory = new Memory();
const requester = new Requester(configPath, path.join(__dirname, "..", "responses"), memory);

console.log(`Listening on port ${configForListen.port}...`);
const server = http.createServer(requestListener);
server.listen(configForListen.port);

console.log(`API is listening on port ${configForListen.apiPort}...`);
const serverApi = http.createServer(apiRequestListener);
serverApi.listen(configForListen.apiPort);

function requestListener(request: IncomingMessage, response: OutgoingMessage) {
    let requestBody = "";
    request.on("data", (chunk) => (requestBody += chunk));
    request.on("end", () => requester.processResponse(request, requestBody, response));
}

function apiRequestListener(request: IncomingMessage, response: OutgoingMessage) {
    let requestBody = "";
    request.on("data", (chunk) => (requestBody += chunk));
    request.on("end", () => {
        let output = null;
        if (request.url.startsWith("/get-last-request/")) {
            output = memory.getLastRequest(request.url.substr(17));
        } else {
            output = memory.getAllRequests();
        }
        response.setHeader("Server", "HttpMockServer");
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(output, null, 2));
    });
}
