import path from "path";
import { Configer } from "../src/configer";
import {
  IConsole,
  IIncomingMessage,
  IOutgoingMessage,
} from "../src/interfaces";
import { HttpListener } from "../src/listeners/http";
import Memory from "../src/memory";
import { Responses } from "../src/responses";

class TestingHttpListener extends HttpListener {
  public override processRequest(
    request: IIncomingMessage,
    requestBody: string,
    response: IOutgoingMessage
  ): Promise<void> {
    return super.processRequest(request, requestBody, response);
  }
}

class TestingResponse implements IOutgoingMessage {
  public headers: any = {};
  public content: string;

  setHeader(key: string, value: string): void {
    this.headers[key] = value;
  }
  end(content: string): void {
    this.content = content;
  }
}
const voidConsole: IConsole = {
  log(..._attrs) {
    // Do not log
  },
};

const configer = new Configer(path.join(__dirname, "config.jsonc"));
const config = configer.loadConfig();
const responsesDirectory = path.join(__dirname, "responses");
const responseProcessors = require(path.join(
  responsesDirectory,
  "processors.js"
));
const memory = new Memory();
const responses = new Responses(
  responsesDirectory,
  configer,
  responseProcessors
);
const listener = new TestingHttpListener(
  config.listeners.http,
  configer,
  memory,
  responses,
  voidConsole
);

describe("http", () => {
  it("unknown request", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: "unknown request",
      headers: {
        "Content-Type": "text/plain",
        Server: "HttpMockServer",
      },
    });
  });

  it("simple file", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/test",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: `{"some":"thing"}`,
      headers: {
        "Content-Type": "text/json",
        Server: "HttpMockServer",
      },
    });
  });

  it("with processor", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/withProcessor",
      method: "GET",
      headers: {
        someHeader: "willBePassedToResponse",
      },
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: `{"SOME":"THING"}`,
      headers: {
        "Content-Type": "text/json",
        Server: "HttpMockServer",
        requestUrl: "/withProcessor",
        someHeader: "willBePassedToResponse",
      },
    });
  });

  it("with async processor", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/withAsyncProcessor",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    const start = Date.now();
    await listener.processRequest(incomingMessage, "", response);
    expect(Date.now() - start).toBeGreaterThanOrEqual(90);
    expect({ ...response }).toStrictEqual({
      content: `{"SOME":"THING"}`,
      headers: {
        "Content-Type": "text/json",
        Server: "HttpMockServer",
      },
    });
  });

  it("async processor does not block other requests", async () => {
    const slowResponse = new TestingResponse();
    const fastResponse = new TestingResponse();
    const finished: string[] = [];
    const slow = listener
      .processRequest({ url: "/withAsyncProcessor", method: "GET", headers: {} }, "", slowResponse)
      .then(() => finished.push("slow"));
    const fast = listener
      .processRequest({ url: "/test", method: "GET", headers: {} }, "", fastResponse)
      .then(() => finished.push("fast"));
    await Promise.all([slow, fast]);
    expect(finished).toStrictEqual(["fast", "slow"]);
  });

  it("failing async processor returns 500", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/withFailingProcessor",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: "Mock server error: processor failed",
      headers: {
        "Content-Type": "text/plain",
        Server: "HttpMockServer",
      },
      statusCode: 500,
    });
  });

  it("status line with code only", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/statusOnly",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: `status only
`,
      headers: {
        "Content-Type": "text/plain",
        Server: "HttpMockServer",
      },
      statusCode: 200,
    });
  });

  it("status line with code and text", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/statusWithText",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: `status with text
`,
      headers: {
        "Content-Type": "text/plain",
        Server: "HttpMockServer",
      },
      statusCode: 201,
      statusMessage: "Created",
    });
  });

  it("status line in HTTP format", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/statusHttp",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: `status http
`,
      headers: {
        "Content-Type": "text/plain",
        Server: "HttpMockServer",
      },
      statusCode: 202,
      statusMessage: "Accepted",
    });
  });

  it("status line in HTTP version format", async () => {
    const incomingMessage: IIncomingMessage = {
      url: "/statusHttpVersion",
      method: "GET",
      headers: {},
    };
    const response = new TestingResponse();
    await listener.processRequest(incomingMessage, "", response);
    expect({ ...response }).toStrictEqual({
      content: `status http version
`,
      headers: {
        "Content-Type": "text/plain",
        Server: "HttpMockServer",
      },
      statusCode: 203,
      statusMessage: "Non-Authoritative Information",
    });
  });
});
