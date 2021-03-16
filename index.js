const { readFileSync } = require("fs");
const http = require("http");
const { join } = require("path");

const config = require("./config.json");

// console.log(
//     "Listen on specific port and print out incoming HTTP requests to console and return response\n" +
//         "\n" +
//         "Usage: node index.js\n" +
//         "\n" +
//         "Options:\n" +
//         "    port            Listen on this port. Default port is 8888.\n" +
//         '    reseponseFile   File that contains headers and body of response. Default response is "Hello World!!!".\n'
// );

console.log(`Listening on port ${config.port}...`);
const server = http.createServer(requestListener);
server.listen(config.port);

/**
 *
 * @param {http.IncomingMessage} request
 * @param {http.OutgoingMessage} response
 */
function requestListener(request, response) {
    let requestBody = "";
    request.on("data", (chunk) => {
        requestBody += chunk;
    });
    request.on("end", () => {
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
        const responseContent = getResponse(request);
        for (const header of Object.keys(responseContent.headers)) {
            response.setHeader(header, responseContent.headers[header]);
        }
        response.end(responseContent.body);
    });
}
/**
 *
 * @param {http.IncomingMessage} request
 */
function getResponse(request) {
    for (const [mask, output] of Object.entries(config.requests)) {
        if (request.url.match(new RegExp(mask))) {
            if (output.startsWith("text:")) {
                return getResponseFromText(output.substr(5));
            }
            if (output.startsWith("file:")) {
                return parseResponseFile(join(__dirname, "responses", output.substr(5)));
            }
            return `Unknown request value in config for mask ${mask}`;
        }
    }
    return getResponseFromText("Unknown request");
}

function getResponseFromText(text) {
    return {
        headers: {
            "Content-Type": "plain",
        },
        body: text,
    };
}

function parseResponseFile(responseFile, defaultResponseLocation) {
    const lines = readFileSync(responseFile)
        .toString()
        .split("\n")
        .map((l) => l.trim());
    const index = lines.indexOf("");
    if (index == -1) {
        console.err(`Response file must contains header, empty line, body. Inspire from file ${defaultResponseLocation}`);
        process.exit(1);
    }
    const headers = {};
    for (let i = 0; i < index; i++) {
        const match = lines[i].match(/^(.*):(.*)$/);
        if (!match) {
            console.err(`Line ${lines[i]} is not valid header`);
        } else {
            headers[match[1].trim()] = match[2].trim();
        }
    }
    return { headers, body: lines.slice(index + 1).join("\n") };
}
