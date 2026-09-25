# Architecture

Functional behaviour is specified in [functionality.md](functionality.md). This document describes how the code is
organised and which names mean what.

## Glossary

Config keys (`requests`, `responses`, `response`, `content`, `responseProcessor`, `sendResponse`) and the processor
parameter names (`requestContent`, `responseContent`) are a public contract and keep their names. Inside the code
every concept has exactly one name:

| Name               | Meaning                                                                                  | Config key / old code name                          |
|--------------------|------------------------------------------------------------------------------------------|-----------------------------------------------------|
| `Rule`             | “what comes in → what goes out”; one entry of a listener's `requests` section            | `requests.*`, `IRequestDefConfig`                   |
| `ReplyRef`         | what a rule replies with: `inline` (text/file), `template`, `remoteTemplate` (other listener) | `response` of a rule                            |
| `ReplyTemplate`    | named reply definition; one entry of a listener's `responses` section                    | `responses.*`, `I…ResponseDefConfig`                |
| `PayloadSource`    | where headers, status and body come from: `text:` or `file:`                             | `content` of a template, `IResponseContentDef`      |
| `InboundMessage`   | message received by a listener (HTTP request, Kafka/AMQP message)                        | `requestContent`, `IRequestContent`                 |
| `OutboundMessage`  | message sent back by the mock (HTTP response, Kafka/AMQP message)                        | `responseContent`, `IResponseContent`               |
| `HistoryEntry`     | one recorded exchange (`inbound` + `outbound`)                                           | `IMemoryData`; JSON keeps `request`/`response`      |
| `replyEnabled`     | whether a broker rule replies                                                            | `sendResponse`                                      |
| `processorName`    | name of the function in `responses/processors.js`                                        | `responseProcessor`                                 |
| `Raw*` types       | config exactly as written in `config.jsonc`, before normalisation                        | `I…Config`                                          |

The word “response” appears in code only where it means Node's `http.ServerResponse` or refers to the config keys.

## Source layout

```
src/
  index.ts                      entry point (dist/index.js): resolves paths, starts MockServerApp
  app.ts                        composition root: creates and wires everything, start()/stop()
  messages.ts                   InboundMessage, OutboundMessage, ListenerType
  config/
    raw-config.ts               Raw* types 1:1 with config.jsonc
    config-provider.ts          reads config.jsonc on every load() (hot reload), schema validation → warnings
    normalize.ts                Raw* → Rule / ReplyRef / ReplyTemplate / PayloadSource
  config.schema.json            JSON schema of config.jsonc (also used for runtime validation)
  replies/
    payload-file-parser.ts      pure parser of response files (status line, headers, body)
    payload-loader.ts           PayloadSource → OutboundMessage (reads files)
    processor-registry.ts       loads processors.js, runs a processor
    reply-builder.ts            payload + processor → OutboundMessage
  history/
    history-store.ts            in-memory HistoryEntry store grouped by endpoint
    history-api.ts              API server handler (JSON endpoints + request-history.html)
  listeners/
    http-listener.ts            HTTP server: CORS, routing, replies, 500 on errors
    rule-matcher.ts             first regex match of HTTP rules
    broker/
      broker-client.ts          BrokerClient interface (connect/subscribe/publish/close) + factory type
      kafka-client.ts           kafkajs adapter
      amqp-client.ts            amqplib adapter (queueSettings)
      broker-listener.ts        common Kafka/AMQP flow: record → rule → dispatch
      broker-registry.ts        running broker listeners by unique name
      broker-reply-dispatcher.ts  delay → template → build → history → publish
  shared/
    delay.ts, logger.ts
```

## Data flow

HTTP request:

```
HttpListener.handleRequest
  → CORS / OPTIONS
  → matchRule(config.listeners.http.requests, url)          (config re-read)
  → ReplyRef:
      inline         → ReplyBuilder.build(source)            → delay
      template       → ReplyBuilder.build(template.source, template.processorName) → delay
      remoteTemplate → "Response will be sent by …"
  → writeReply (validated headers, status)   ── error anywhere → 500 "Mock server error: …"
  → HistoryStore.record("http", url, inbound, outbound)
  → end
  → remoteTemplate: BrokerReplyDispatcher.dispatch(…)  (async, errors logged)
```

Broker message:

```
BrokerClient (kafka/amqp) → BrokerListener.handleMessage (never rejects)
  → HistoryStore.record(type, "/" + topic, inbound, null)
  → normalizeRule(topic, startup config)
  → replyEnabled: BrokerReplyDispatcher.dispatch
       delay → target listener (own or <listener>:) → template from current config
       → ReplyBuilder.build → entry.outbound = reply → BrokerListener.publish → BrokerClient.publish
```

## Tests

| Folder            | What                                                                                   | How                                              |
|-------------------|----------------------------------------------------------------------------------------|--------------------------------------------------|
| `tests/contract`  | black-box behaviour of HTTP listener, response files, processors, History API, hot reload | spawns `node dist/index.js` over a temp root (`HTTP_MOCK_SERVER_ROOT`) |
| `tests/broker`    | Kafka/AMQP flow, cross-listener replies, HTTP → broker, startup errors                 | in-process `MockServerApp` with `FakeBrokerClient` |
| `tests/unit`      | parsers, normalisation, matcher, history store, processors, Kafka/AMQP adapters         | plain unit tests, libraries mocked with `jest.mock` |

The contract tests were written against version 1.0.13 first and passed there (the tests for fixed defects were
`it.failing`), so they guard the compatibility of the rewrite. `npm test` builds the project before running them.

## Dependencies

- Node.js 22+, TypeScript 6.0 (TypeScript 7 is not supported by ts-jest yet).
- `kafkajs` 2, `amqplib` 2 (bundled types), `jsonc-parser`, `ajv`.
- Jest 30 + ts-jest, [Biome](https://biomejs.dev/) linter and formatter (`biome.json`).
