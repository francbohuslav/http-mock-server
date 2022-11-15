import path from "path";
import { Configer } from "../src/configer";
import { IConsole, IIncomingMessage, IOutgoingMessage } from "../src/interfaces";
import { HttpListener } from "../src/listeners/http";
import Memory from "../src/memory";
import { Responses } from "../src/responses";

class TestingHttpListener extends HttpListener {
  public override processRequest(request: IIncomingMessage, requestBody: string, response: IOutgoingMessage): Promise<void> {
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
const responseProcessors = require(path.join(responsesDirectory, "processors.js"));
const memory = new Memory();
const responses = new Responses(responsesDirectory, configer, responseProcessors);
const listener = new TestingHttpListener(config.listeners.http, configer, memory, responses, voidConsole);

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
        someHeader: "willBePassedToResponse",
      },
    });
  });
});
