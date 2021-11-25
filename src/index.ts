import http from "http";
import { IncomingMessage, OutgoingMessage } from "node:http";
import path from "path";
import { exit } from "process";
import { IConfig } from "./interfaces";
import { AmqpListener } from "./listeners/amqp";
import { HttpListener } from "./listeners/http";
import { KafkaListener } from "./listeners/kafka";
import Memory from "./memory";
import { Responses } from "./responses";

const configPath = path.join(__dirname, "..", "config.json");
const responsesDirectory = path.join(__dirname, "..", "responses");

const config: IConfig = require(configPath);
const responseProcessors = require(path.join(responsesDirectory, "processors.js"));

const memory = new Memory();

console.log(`API is listening on port ${config.apiPort}...`);
const serverApi = http.createServer(apiRequestListener);
serverApi.listen(config.apiPort);

const responses = new Responses(responsesDirectory, configPath, responseProcessors);
if (config.listeners.http) {
    new HttpListener(config.listeners.http, configPath, memory, responses).listen();
}

if (config.listeners.kafka) {
    for (const name of Object.keys(config.listeners.kafka)) {
        const kafkaConfig = config.listeners.kafka[name];
        const listener = new KafkaListener(name, kafkaConfig, memory, responses);
        responses.registerListener(name, listener);
        listener.listen().catch((err) => {
            console.error(err);
            exit(1);
        });
    }
}

if (config.listeners.amqp) {
    for (const name of Object.keys(config.listeners.amqp)) {
        const amqpConfig = config.listeners.amqp[name];
        const listener = new AmqpListener(name, amqpConfig, memory, responses);
        responses.registerListener(name, listener);
        listener.listen().catch((err) => {
            console.error(err);
            exit(1);
        });
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
