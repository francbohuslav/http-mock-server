import { IncomingMessage, OutgoingMessage } from "node:http";
import path from "path";
import { IConfig } from "./interfaces";
import http from "http";
import Requester from "./requester";


const config:IConfig = require("../config.json");

console.log(`Listening on port ${config.port}...`);
const server = http.createServer(requestListener);
server.listen(config.port);

function requestListener(request: IncomingMessage, response: OutgoingMessage) {
    let requestBody = "";
    request.on("data", (chunk) => {
        requestBody += chunk;
    });
    const requester = new Requester(path.join(__dirname, "..", "responses"));
    request.on("end", () => {
        requester.processResponse(request, requestBody, response, config);
    });
}
