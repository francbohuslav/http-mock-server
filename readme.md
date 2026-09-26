# HTTP Mock Server

[![GitHub Repo](https://img.shields.io/badge/repo-http--mock--server-181717?logo=github)](https://github.com/francbohuslav/http-mock-server)
[![GitHub Stars](https://img.shields.io/github/stars/francbohuslav/http-mock-server?style=flat)](https://github.com/francbohuslav/http-mock-server/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/francbohuslav/http-mock-server?style=flat)](https://github.com/francbohuslav/http-mock-server/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/francbohuslav/http-mock-server)](https://github.com/francbohuslav/http-mock-server/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/francbohuslav/http-mock-server)](https://github.com/francbohuslav/http-mock-server/commits/master)
[![License](https://img.shields.io/github/license/francbohuslav/http-mock-server)](https://github.com/francbohuslav/http-mock-server/blob/master/LICENSE)

Simple mock server for HTTP, Kafka, and AMQP workflows.

It captures incoming requests/messages, stores history in memory, and returns configured responses from inline text, files, or custom response processors.

## Features

- HTTP listener with regex-based routing
- Kafka and AMQP listeners with configurable response flow
- Delayed responses (`delay` in milliseconds)
- Custom response processors (`responses/processors.js`)
- In-memory API to inspect request/response history
- JSONC configuration with schema (`src/config.schema.json`)

## Requirements

- [Node.js](https://nodejs.org/) 22 or newer
- npm

## Installation

```bash
npm install
npm run build
```

## Run

After build:

```bash
npm start
```

Development mode (TypeScript in watch mode, server restarts on every change):

```bash
npm run dev
```

`SIGTERM` or `SIGINT` (Ctrl+C, `docker stop`) stops the server gracefully: broker connections and HTTP servers are
closed, the process exits with code `0`. When it does not finish in 5 seconds or a second signal arrives, the process
exits immediately.

## How It Works

The app starts:

- API server for request history (`apiPort`)
- HTTP listener (`listeners.http`)
- Optional Kafka listeners (`listeners.kafka`)
- Optional AMQP listeners (`listeners.amqp`)

Incoming data is transformed to `requestContent`, matched against configuration, and response is produced from:

- `text:...`
- `file:...`
- named response definition with optional `responseProcessor`

## Configuration

Main config file: `config.jsonc`  
Schema: `src/config.schema.json`

### Minimal HTTP example

```json
{
  "$schema": "./src/config.schema.json",
  "apiPort": 4445,
  "listeners": {
    "http": {
      "enabled": true,
      "port": 4444,
      "requests": {
        "^/health$": "text:ok",
        "^/users/\\d+$": {
          "sendResponse": true,
          "delay": 100,
          "response": "userDetail"
        },
        "": "text:unknown request"
      },
      "responses": {
        "userDetail": {
          "content": "file:userDetail.json",
          "responseProcessor": "enrichResponse"
        }
      }
    }
  }
}
```

`listeners.http.enabled` is optional. If omitted, listener is enabled by default.

### Message broker request mapping

For Kafka/AMQP listeners:

- `enabled` can be set per endpoint (`listeners.kafka.<name>` / `listeners.amqp.<name>`)
- `requests.<topic>` defines behavior for incoming topic/queue
- `sendResponse` decides whether a response is sent
- `response` supports:
  - local response name (inside the same listener)
  - cross-listener form `listenerName:responseName`

Kafka endpoint example:

```json
"kafka": {
  "kafka1": {
    "enabled": false,
    "host": "localhost:9092"
  }
}
```

AMQP endpoint example:

```json
"amqp": {
  "amqp1": {
    "enabled": true,
    "host": "amqp://guest:guest@localhost:5672/dfg?adminPort=15672"
  }
}
```

## Response Files

`file:...` points to a file in the `responses` directory.

Response file format:

```txt
Content-Type: application/json
X-Custom: value

{"status":"ok"}
```

- Header section first (`Name: value`, split on the first `:`)
- Empty line separator (mandatory, otherwise the request is answered with `500`)
- Body afterwards, whitespace is preserved (CRLF line endings are converted to LF)
- Optional status line can be the first header row (must not contain `:`)
- Status line is evaluated only on the first header row
- Response files are read on every request, so they can be edited without restart

Supported status line formats:

- `HTTP/1.1 200 text`
- `HTTP 200 text`
- `200 text`
- `200`

Example with status line:

```txt
HTTP/1.1 201 Created
Content-Type: application/json

{"status":"created"}
```

## Response Processors

Processor file: `responses/processors.js`

Each processor has signature:

```js
function processor(requestContent, responseContent) {
  // modify responseContent here
}
```

A processor can be `async` (return a `Promise`). The mock waits for it before sending the response, without blocking
other requests, so it can e.g. delay the response. The return value is ignored, modify `responseContent` instead.
If the processor throws or rejects, HTTP listener answers with status `500`.

Order against `delay` from request definition:

- HTTP listener: processor runs first, then `delay` is applied
- Kafka/AMQP listener: `delay` is applied first, then processor runs

```js
const responseProcessors = {
  async delayedResponse(requestContent, responseContent) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    responseContent.body = "x";
  },
};
```

`requestContent.url` is available for custom routing logic:

- HTTP listener: original request URL (for example `/api/orders/123`)
- Kafka listener: incoming topic name
- AMQP listener: incoming topic/queue name

Example:

```js
const responseProcessors = {
  enrichResponse(requestContent, responseContent) {
    if (requestContent.url?.startsWith("/users/")) {
      responseContent.headers["X-Mock-Source"] = "users-endpoint";
    }
  },
};
```

## History API

API port is configured by `apiPort`.

- `GET /` (or any other URL) - history web page
- `GET /get-all-requests/` - full history as JSON
- `GET /get-last-request/{endpoint}` - last request for endpoint as JSON (empty body when there is none)
- `GET /clear-history/` - clear in-memory history

Notes:

- HTTP requests are stored under their URL including the query string (for example `/health` or `/users?id=1`),
  so `/get-last-request/health` returns the last request of `/health`
- Kafka/AMQP requests are stored under `/{topic}`, the reply is added when it is sent

## Hot reload

Without restart you can change HTTP `requests` and `responses`, broker `responses` and all response files.
Ports, hosts, broker subscriptions and `processors.js` require a restart.

Schema violations of `config.jsonc` are printed on startup as `Config warning: …`, the server starts anyway.

## npm Scripts

- `npm run build` - compile TypeScript to `dist`
- `npm start` - run compiled app
- `npm run dev` - TypeScript watch mode + server restarted by `node --watch`
- `npm test` - build and run Jest tests
- `npm run lint` - Biome linter, `npm run lint-fix` - apply safe fixes
- `npm run format` - format code with Biome, `npm run check` - lint + formatting check

## Testing

Run all tests:

```bash
npm test
```

## Project Structure

- `src/index.ts` - application entry point, `src/app.ts` - wiring of all parts
- `src/config/` - loading, validation and normalisation of `config.jsonc`
- `src/replies/` - response files, processors, building of replies
- `src/listeners/` - HTTP listener and Kafka/AMQP listeners
- `src/history/` - in-memory history and History API
- `responses/` - response files and processors
- `tests/` - contract (black-box), broker and unit tests
- `docs/architecture.md` - code structure and glossary

## Troubleshooting

- Ensure `config.jsonc` exists at project root before running app
  (or set `HTTP_MOCK_SERVER_ROOT` to a directory with `config.jsonc` and `responses/`)
- Ensure `responses/processors.js` exports an object with processor functions
- If a processor name is configured but missing in `processors.js`, the request is answered with `500`
- For broker listeners, verify host and topic/queue names match your environment
