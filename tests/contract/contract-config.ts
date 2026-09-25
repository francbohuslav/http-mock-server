import path from "path";
import { MockServerConfig } from "../harness/mock-server-process";

export const FIXTURE_DIR = path.join(__dirname, "fixture");

export const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Config shared by the HTTP contract tests. Keys are regexes, the first match wins.
 */
export function createHttpConfig(): MockServerConfig {
  return {
    listeners: {
      http: {
        requests: {
          "^/text$": "text:plain text",
          "^/file$": "file:json.txt",
          "^/noContentType$": "file:noContentType.txt",
          "^/invalidHeader$": "file:invalidHeader.txt",
          "^/indentedJson$": "file:indentedJson.txt",
          "^/urlHeader$": "file:urlHeader.txt",
          "^/noSeparator$": "file:noSeparator.txt",
          "^/reloadable$": "file:reloadable.txt",
          "^/statusOnly$": "file:statusOnly.txt",
          "^/statusWithText$": "file:statusWithText.txt",
          "^/statusHttp$": "file:statusHttp.txt",
          "^/statusHttpVersion$": "file:statusHttpVersion.txt",
          "^/serverError$": "file:serverError500.txt",
          "^/missingFile$": "file:doesNotExist.txt",
          "^/order": "text:first",
          "^/order/second": "text:second",
          "^/query\\?a=1$": "text:query matched",
          "^/delayed$": { delay: 150, response: "text:delayed" },
          "^/fullFormText$": { sendResponse: false, response: "text:full form" },
          "^/template$": "jsonTemplate",
          "^/textTemplate$": "textTemplate",
          "^/unknownTemplate$": "unknownTemplate",
          "^/withProcessor$": { sendResponse: true, delay: 10, response: "withProcessor" },
          "^/echo$": "echo",
          "^/setStatus$": "setStatus",
          "^/withAsyncProcessor$": "withAsyncProcessor",
          "^/withFailingProcessor$": "withFailingProcessor",
          "^/missingProcessor$": "missingProcessor",
          "^/returnsValue$": "returnsValue",
          "^/processorAndDelay$": { delay: 150, response: "withAsyncProcessor" },
          "^/external$": "kafka1:someResponse",
          "": "text:unknown request",
        },
        responses: {
          jsonTemplate: { content: "file:json.txt" },
          textTemplate: { content: "text:template text" },
          withProcessor: { content: "file:json.txt", responseProcessor: "upperCase" },
          echo: { content: "text:", responseProcessor: "echoRequest" },
          setStatus: { content: "text:teapot", responseProcessor: "setStatus" },
          withAsyncProcessor: { content: "file:json.txt", responseProcessor: "delayedUpperCase" },
          withFailingProcessor: { content: "file:json.txt", responseProcessor: "failing" },
          missingProcessor: { content: "file:json.txt", responseProcessor: "doesNotExist" },
          returnsValue: { content: "text:original", responseProcessor: "returnsValue" },
        },
      },
    },
  };
}
