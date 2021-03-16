const { readFileSync } = require("fs");
const http = require("http");
const { join } = require("path");

const args = process.argv.slice(2);

const defaultResponseLocation = join(__dirname, "defaultResponse.txt");

const port = args.length > 0 ? args[0] : "8888";
const responseFile = args.Length > 1 ? args[1] : defaultResponseLocation;
const responseContent = parseResponseFile(responseFile, defaultResponseLocation);

console.log(
    "Listen on specific port and print out incoming HTTP requests to console and return response\n" +
        "\n" +
        "Usage: node index.js [port] [responseFile]\n" +
        "\n" +
        "Options:\n" +
        "    port            Listen on this port. Default port is 8888.\n" +
        '    reseponseFile   File that contains headers and body of response. Default response is "Hello World!!!".\n'
);

console.log(`Listening on port ${port}...`);
const server = http.createServer(requestListener);
server.listen(port);

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
        for (const header of Object.keys(responseContent.headers)) {
            response.setHeader(header, responseContent.headers[header]);
        }
        response.end(responseContent.body);
    });
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
/*

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace HttpRequestsDumper
{
    internal class Program
    {
        private static void Main(string[] args)
        {

            var exeLocation = System.Reflection.Assembly.GetEntryAssembly().Location;
            var exeFileName = Path.GetFileNameWithoutExtension(exeLocation);
    
            
        }

 

        private static string StreamToText(Stream stream)
        {
            using (var readStream = new StreamReader(stream, Encoding.UTF8))
            {
                return readStream.ReadToEnd();
            }
        }
    }
}
*/
