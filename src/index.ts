import http from "http";
import { IncomingMessage, OutgoingMessage } from "node:http";
import path from "path";
import { IConfig } from "./interfaces";
import { HttpListener } from "./listeners/http";
import { KafkaListener } from "./listeners/kafka";
import Memory from "./memory";
import { Responses } from "./responses";

const configPath = path.join(__dirname, "..", "config.json");
const config: IConfig = require(configPath);
const memory = new Memory();
const responsesDirectory = path.join(__dirname, "..", "responses");

console.log(`API is listening on port ${config.apiPort}...`);
const serverApi = http.createServer(apiRequestListener);
serverApi.listen(config.apiPort);

const responses = new Responses(responsesDirectory);
if (config.listeners.http) {
    new HttpListener(config.listeners.http, configPath, memory, responses).listen();
}

if (config.listeners.kafka) {
    for (const kafkaConfig of config.listeners.kafka) {
        new KafkaListener(kafkaConfig, memory, responses).listen();
    }
}

function apiRequestListener(request: IncomingMessage, response: OutgoingMessage) {
    let requestBody = "";
    request.on("data", (chunk) => (requestBody += chunk));
    request.on("end", () => {
        let output = null;
        if (request.url.startsWith("/get-last-request/")) {
            output = memory.getLastRequest(request.url.substr(17));
        } else if (request.url.startsWith("/clear-history/")) {
            memory.clear();
            output = "Memory cleared";
        } else {
            output = memory.getAllRequests();
        }
        response.setHeader("Server", "HttpMockServer");
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(output, null, 2));
    });
}
