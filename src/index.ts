import { IncomingMessage, OutgoingMessage } from "node:http";
import path from "path";
import http from "http";
import Requester from "./requester";

const configPath = path.join(__dirname, "..", "config.json");
const configForListen = require(configPath);
const requester = new Requester(configPath, path.join(__dirname, "..", "responses"));

console.log(`Listening on port ${configForListen.port}...`);
const server = http.createServer(requestListener);
server.listen(configForListen.port);

function requestListener(request: IncomingMessage, response: OutgoingMessage) {
    let requestBody = "";
    request.on("data", (chunk) => (requestBody += chunk));
    request.on("end", () => requester.processResponse(request, requestBody, response));
}
