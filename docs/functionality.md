# HTTP Mock Server – Functional Specification

This document describes **everything the mock server does**, as observed in version 1.0.13 (before the rewrite).
It is the reference for the rewrite: every behaviour listed here must be preserved unless it is explicitly
marked as a defect in [Known quirks and defects](#11-known-quirks-and-defects) with the decision *fix*.

External contracts that must stay 100 % compatible:

- the configuration file format (`config.jsonc`, `src/config.schema.json`),
- the response file format (`responses/*.txt`),
- the response processor API (`responses/processors.js`),
- the History API (URLs and JSON shape) and the history web page (`request-history.html`),
- the file layout used by the Docker image (`dist/index.js`, `config.jsonc`, `responses/`, `request-history.html`).

---

## 1. Startup

1. All paths are resolved relative to the project root, which is `dist/..` (the parent of the compiled entry
   point `dist/index.js`):
   - configuration: `<root>/config.jsonc`,
   - response files and processors: `<root>/responses/`,
   - history web page: `<root>/request-history.html`.
2. The configuration is parsed as JSONC (comments allowed) by the `jsonc` package. It is **not validated** against
   the schema at runtime.
3. `<root>/responses/processors.js` is loaded once with `require`. It is mandatory – a missing file crashes the
   startup. Changes to it require a restart.
4. The API (history) server starts on `apiPort` and logs `API is listening on port <apiPort>...`.
5. The HTTP listener starts on `listeners.http.port` when `listeners.http` exists and `enabled !== false`.
6. For every entry of `listeners.kafka` and `listeners.amqp` whose `enabled !== false` a broker listener is created and
   registered under its name. Names must be unique across Kafka and AMQP together, otherwise startup throws
   `Listener <name> already registered. Name must be unique across whole config.` Disabled listeners are not
   registered.
7. When a broker listener fails to connect/subscribe, the error is printed and the process exits with code `1`.

## 2. Configuration

```jsonc
{
  "$schema": "./src/config.schema.json",
  "apiPort": 4445,
  "listeners": {
    "http": {
      "enabled": true,           // optional, default true
      "port": 4444,
      "requests": { "<url regex>": <rule> },
      "responses": { "<template name>": { "content": "text:..|file:..", "responseProcessor": "<fn>" } }
    },
    "kafka": { "<listener name>": <broker listener> },
    "amqp":  { "<listener name>": <broker listener> }
  }
}
```

Broker listener:

```jsonc
{
  "enabled": true,               // optional, default true
  "host": "localhost:9092",      // Kafka broker or AMQP URL (amqp://user:pass@host:port/vhost)
  "requests": { "<topic/queue>": <rule> },
  "responses": {
    "<template name>": {
      "content": "text:..|file:..",
      "responseProcessor": "<fn>",  // optional
      "targetTopic": "<topic/queue>"
    }
  },
  "queueSettings": { "<queue regex>": { /* amqplib assertQueue options */ } } // AMQP only
}
```

### Rules (`requests` entries)

A rule is either a **string** (short form) or an **object** (full form):

| Field          | Meaning                                                                          | Default (short form) |
|----------------|----------------------------------------------------------------------------------|----------------------|
| `response`     | reference to the reply – see below                                               | the string itself    |
| `delay`        | delay in milliseconds                                                            | `0`                  |
| `sendResponse` | brokers only: whether to send a reply at all; ignored by the HTTP listener       | `true`               |

The `response` reference can be:

| Form                  | Meaning                                                                     |
|-----------------------|-----------------------------------------------------------------------------|
| `text:<text>`         | inline text body                                                            |
| `file:<file name>`    | response file in `responses/`                                               |
| `<name>`              | template from the `responses` section of the **same** listener              |
| `<listener>:<name>`   | template from the `responses` section of another **broker** listener        |

A reference is considered *external* (`<listener>:<name>`) when it contains `:` and does not start with `text:` or
`file:`.

### Template `content`

`content` is `text:<text>` or `file:<file name>` – the same as the inline reference forms.
Any other value throws `Unknown response definition <value>`.

### Hot reload

| Part                                  | Re-read without restart?                               |
|---------------------------------------|--------------------------------------------------------|
| `listeners.http.requests`             | yes – the config file is re-read on every HTTP request |
| `listeners.http.responses`            | **no** – taken from the startup config (defect Q5)     |
| broker `responses`                    | yes – re-read every time a broker reply is sent        |
| broker `requests` (subscriptions)     | no                                                     |
| ports, hosts, `enabled`, `queueSettings` | no                                                  |
| response files (`responses/*.txt`)    | yes – read on every use                                |
| `processors.js`                       | no                                                     |

## 3. HTTP listener

For every request:

1. CORS headers are set: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: *`,
   `Access-Control-Allow-Headers: *`.
2. `OPTIONS` requests are answered with `204` and an empty body. They are **not** logged and **not** stored in history.
3. The body is collected as a string.
4. The request is logged to the console (separator line with local time, `Received <METHOD> request for <url>`,
   headers, body or `{no body}`).
5. Default headers `Server: HttpMockServer` and `Content-Type: text/plain` are set.
6. **Routing:** the rules in `listeners.http.requests` are tested in key order; the first key whose `RegExp` matches
   `request.url` wins. `request.url` includes the query string. The key `""` matches everything (catch-all).
   No match → error `Unknown request` (→ 500, see step 10).
7. **Reply resolution** by the rule's `response`:
   - *external* `<listener>:<name>` → body `Response will be sent by <listener>:<name>` with `Content-Type: text/plain`;
     the broker reply is sent after the HTTP response is finished (see [Broker reply flow](#8-broker-reply-flow)),
   - `text:<text>` → body `<text>`, `Content-Type: text/plain`,
   - `file:<file>` → parsed response file,
   - `<name>` → template from `listeners.http.responses`; unknown name → error `Unknown response "<name>"`;
     the template `content` is resolved (text/file); if `responseProcessor` is set, the processor runs.
8. **Order:** processor first, then `delay` (if non-zero).
9. Headers from the reply are set on the response (overriding the defaults), then `statusCode` (if defined) and
   `statusMessage` (if non-empty).
10. **Errors** in steps 6–8 (unknown request, unknown template, failing/missing processor, missing file…) are caught:
    the request is answered with status `500`, `Content-Type: text/plain` and body
    `Mock server error: <error message>`. The stored reply contains an `error` field with `String(error)`.
11. The request and the reply are stored in history under the key `request.url` with type `http`. The reply `time`
    is set to the moment of sending.
12. The response is ended with the reply body.
13. If the rule was external, the broker reply is dispatched asynchronously; errors are only logged
    (`Error while sending response <ref>`).

The HTTP listener cannot be the target of an external reference (`http:<name>` does not work).

## 4. Response files

```
[status line]
Header-Name: value
Other-Header: value

body…
```

- The file is split on `\n` and **every line is trimmed** (this removes `\r`, a BOM and – unfortunately – the
  indentation of body lines, defect Q6).
- The first empty line separates headers from the body. The body is the rest of the lines joined with `\n`.
- If there is no empty line, the error `Response file must contains header, empty line, body…` is printed and the
  **process exits** (defect Q1).
- Only the first line may be a status line, and only when it does not contain `:`. Supported formats
  (regex `^(?:HTTP(?:\/\S+)?\s+)?(\d+)(?:\s+(.+))?$`):
  - `HTTP/1.1 200 text`
  - `HTTP 200 text`
  - `200 text`
  - `200`
- A first line without `:` that is not a valid status line, or any later line without `:`, is logged as
  `Line <line> is not valid header` and ignored.
- Header lines are split on the **last** `:`; name and value are trimmed.
- A file that consists of just a status line and a trailing newline (for example `serverError500.txt`) is valid: it
  has an empty body.

## 5. Response processors

`responses/processors.js` exports an object of functions:

```js
module.exports = {
  myProcessor(requestContent, responseContent) {
    responseContent.body = "…";
  },
};
```

- `requestContent`: `{ time, url, headers, body }` of the incoming request/message.
  `url` is the HTTP URL (with query) for HTTP, or the topic/queue name for Kafka/AMQP.
- `responseContent`: `{ time, headers, body, statusCode?, statusMessage? }` – the reply being built; the processor
  mutates it. The return value is ignored.
- The processor may be `async`; the mock awaits it without blocking other requests.
- Unknown processor name → error `ResponseProcessor <name> is not in function(requestContent, responseContent) in
  file processors.js.` (HTTP → 500).
- A thrown error/rejection → HTTP 500; on brokers the reply is not sent and the error is logged.

## 6. Kafka listener

- `kafkajs` client with `clientId: "http-mock-server"` and `brokers: [host]`.
- Consumer group `group_id.mockserver<timestamp>` (a new group on every start), round-robin partition assigner,
  `fromBeginning: false` – only messages produced after startup are received.
- Subscribes to every key of `requests`.
- Incoming message → `requestContent = { time, url: topic, headers: message.headers, body: message.value.toString() }`.
  Kafka header values are `Buffer`s; in the history JSON they appear as `{ "type": "Buffer", "data": [...] }`.
- Reply is sent by `producer.send({ topic: targetTopic, messages: [{ headers, value: body }] })`.
  `statusCode`/`statusMessage` are ignored.

## 7. AMQP listener

- `amqplib` callback API, `amqp.connect(host)`, one channel.
- For every key of `requests` the queue is asserted and consumed with `noAck: true`.
- `assertQueue` options come from `queueSettings`: every regex key that matches the queue name is applied and the
  **last** match wins. The same is done for reply target queues before the first send.
- Incoming message → `requestContent = { time, url: queue, headers: properties.headers, body: content.toString() }`.
- Reply: `channel.sendToQueue(targetTopic, Buffer.from(body), { headers })`.
- SSL (`amqps://`) is only prepared in commented-out code.

## 8. Broker reply flow

Incoming message on a broker listener:

1. Logged (`Received <kafka|amqp> request in <topic> topic`, headers, body).
2. Stored in history under `/<topic>` with type `kafka`/`amqp` and `response: null`.
3. If the rule's `sendResponse` is truthy:
   1. wait `delay` ms,
   2. resolve the reference: `<name>` → current listener, `<listener>:<name>` → that listener,
   3. re-read the config and find the target listener's config (first in `kafka`, then in `amqp`) and its template,
      unknown template → `Unknown response "<name>" for listener <listener>`,
   4. build the reply from the template `content`,
   5. run the `responseProcessor` (with the **incoming** message as `requestContent`),
   6. set the reply `time` and store the reply into the history entry (replacing `null`),
   7. log `Sending <type> response to topic <targetTopic>` and publish it through the target listener.

The same flow (steps 3.1–3.7) is used for HTTP requests with an external reference; there the history entry of the
HTTP request gets its `response` **replaced** by the broker reply (Q8).

Order: `delay` first, then processor (the opposite of HTTP).

## 9. History (API server on `apiPort`)

History is kept in memory, grouped by endpoint key, and grows without limit.

| Request                         | Response                                                                 |
|---------------------------------|--------------------------------------------------------------------------|
| `/get-all-requests/…`           | JSON of the whole history                                                |
| `/get-last-request/<endpoint>`  | JSON of the last entry for `<endpoint>`. Only the prefix `/get-last-request` (17 chars) is cut, so the key keeps its leading `/`: `/get-last-request/test` → key `/test`, `/get-last-request/test?a=1` → key `/test?a=1`. Unknown endpoint → empty body (no JSON) |
| `/clear-history/…`              | clears history, JSON `"Memory cleared"`                                  |
| anything else (including `/`)   | the history web page `request-history.html` (`text/html; charset=utf-8`) |

JSON responses have `Content-Type: application/json`, `Server: HttpMockServer` and are pretty-printed with 2 spaces.
The API has no CORS headers. Prefix matching uses `startsWith`, so `/get-all-requests` without a trailing slash
returns the web page.

JSON shape:

```json
{
  "/test": [
    {
      "type": "http",
      "endpoint": "/test",
      "request":  { "time": "ISO", "url": "/test", "headers": { }, "body": "" },
      "response": { "time": "ISO", "headers": { }, "body": "…", "statusCode": 200, "statusMessage": "OK", "error": "…" }
    }
  ]
}
```

`statusCode`, `statusMessage` and `error` are present only when set. Broker entries have `response: null` until a
reply is sent.

### History web page

`request-history.html` is a single-file React 18 app (React, ReactDOM, Babel and Tailwind loaded from CDNs):

- loads `/get-all-requests/`, lists endpoints sorted alphabetically as collapsible panels with the request count,
- inside a panel: a table (newest first) with time, type and buttons showing request/response JSON in a modal,
- the modal has an editable textarea and an “Apply \n” toggle that replaces literal `\n` with new lines,
- “Clear history” calls `/clear-history/` and reloads.

## 10. Deployment and tooling

- npm scripts: `build` (tsc → `dist`), `start` (`node dist/index.js`), `devel` (nodemon on `dist`), `watch`, `test`.
- `run.bat`, `pull_and_build.bat` – Windows helpers.
- Docker image (separate repo `../docker`): clones the git tag, runs `npm i` and `npm run build`, starts
  `node index.js` in `dist`, the user mounts `config.jsonc` and `responses/` into `/http-mock-server/`.
  The Dockerfile declares `VOLUME /http-mock-server/config.js` (typo, should be `config.jsonc`) and uses `node:16`.
- The Bruno collection (`../bruno`) contains `POST /set-response` requests – this endpoint is **not implemented**.

## 11. Known quirks and defects

| ID  | Behaviour in 1.0.13                                                                                      | Decision                                                    |
|-----|----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| Q1  | Response file without an empty line calls `process.exit(1)` in the middle of a request                    | **fix** – error, HTTP answers 500                           |
| Q2  | Kafka/AMQP handlers do not await the processing; a rejection (e.g. failing processor) is unhandled and crashes Node | **fix** – await and log                            |
| Q3  | AMQP listener without `queueSettings` throws TypeError → exit(1)                                          | **fix** – treat as `{}`                                     |
| Q4  | `/get-last-request/` (empty endpoint) looks up key `/` and usually returns an empty body – the intended “return all” branch is unreachable | **fix** – return the whole history                         |
| Q5  | `http.responses` is not hot-reloaded while `http.requests` is                                             | **fix** – both reload                                       |
| Q6  | Body lines of response files are trimmed – JSON indentation and trailing spaces are lost                  | **fix** – only strip `\r` and BOM; headers are still trimmed |
| Q7  | Broker rule in the short (string) form crashes                                                           | **fix** – normalised like HTTP rules                        |
| Q8  | HTTP request with an external reference: its history `response` is replaced by the broker reply          | keep (documented)                                           |
| Q9  | AMQP message without `properties.headers` crashes when logging                                           | **fix** – `{}`                                              |
| Q10 | Kafka tombstone (`value: null`) crashes                                                                  | **fix** – empty body                                        |
| Q11 | External reference to a missing/disabled listener fails with an obscure TypeError                        | **fix** – clear error message                               |
| Q12 | Broker listeners log via the global `console` instead of the injected one                                | **fix**                                                     |
| Q13 | Misleading processor error message, typo `getQueueSettins`                                               | **fix**                                                     |
| Q14 | `apiPort`/`port` typed as `string` in TS but `integer` in the schema; config never validated              | **fix** – validate on startup, report violations as warnings only (old configs keep working) |
