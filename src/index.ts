import fs from "fs";
import http from "http";
import { IncomingMessage, OutgoingMessage } from "node:http";
import path from "path";
import { exit } from "process";
import { Configer } from "./configer";
import { IConfig } from "./interfaces";
import { AmqpListener } from "./listeners/amqp";
import { HttpListener } from "./listeners/http";
import { KafkaListener } from "./listeners/kafka";
import Memory from "./memory";
import { Responses } from "./responses";

const rootDirectory = process.env.HTTP_MOCK_SERVER_ROOT || path.join(__dirname, "..");
const responsesDirectory = path.join(rootDirectory, "responses");

const configer = new Configer(path.join(rootDirectory, "config.jsonc"));
const config: IConfig = configer.loadConfig();
const responseProcessors = require(path.join(responsesDirectory, "processors.js"));
const requestHistoryGuiPath = path.join(__dirname, "..", "request-history.html");

const memory = new Memory();

console.log(`API is listening on port ${config.apiPort}...`);
const serverApi = http.createServer(apiRequestListener);
serverApi.listen(config.apiPort);

const responses = new Responses(responsesDirectory, configer, responseProcessors);
if (config.listeners.http && config.listeners.http.enabled !== false) {
  new HttpListener(config.listeners.http, configer, memory, responses, console).listen();
}

if (config.listeners.kafka) {
  for (const name of Object.keys(config.listeners.kafka)) {
    const kafkaConfig = config.listeners.kafka[name];
    if (kafkaConfig.enabled === false) {
      continue;
    }
    const listener = new KafkaListener(name, kafkaConfig, memory, responses, console);
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
    if (amqpConfig.enabled === false) {
      continue;
    }
    const listener = new AmqpListener(name, amqpConfig, memory, responses, console);
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
    let output;
    if (request.url.startsWith("/get-all-requests/")) {
      output = memory.getAllRequests();
    } else if (request.url.startsWith("/get-last-request/")) {
      if (request.url.substr(17) === "") {
        output = memory.getAllRequests();
      } else {
        output = memory.getLastRequest(request.url.substr(17));
      }
    } else if (request.url.startsWith("/clear-history/")) {
      memory.clear();
      output = "Memory cleared";
    } else {
      response.setHeader("Server", "HttpMockServer");
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(renderRequestHistoryGui());
      return;
    }
    response.setHeader("Server", "HttpMockServer");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(output, null, 2));
  });
}

function renderRequestHistoryGui(): string {
  return fs.readFileSync(requestHistoryGuiPath, "utf-8");
}
