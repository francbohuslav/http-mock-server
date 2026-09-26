import { MockServerProcess } from "../harness/mock-server-process";
import { createHttpConfig, FIXTURE_DIR } from "./contract-config";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BINARY = Buffer.concat([PNG_SIGNATURE, Buffer.from([0x00, 0xff, 0x0d, 0x0a, 0x0a, 0x20, 0x80])]);

let server: MockServerProcess;

beforeAll(async () => {
  server = await MockServerProcess.start(createHttpConfig(), FIXTURE_DIR);
});

afterAll(async () => {
  await server.stop();
});

beforeEach(async () => {
  await server.api("/clear-history/");
});

describe("binary bodies", () => {
  it("records a binary request body as base64", async () => {
    await server.http("/text", { method: "POST", body: BINARY });
    const entry = await server.apiJson("/get-last-request/text");
    expect(entry.request.body).toBe(BINARY.toString("base64"));
    expect(entry.request.bodyEncoding).toBe("base64");
    expect(entry.response.bodyEncoding).toBeUndefined();
  });

  it("joins a multi-byte character split between chunks", async () => {
    const text = Buffer.from("žluťoučký kůň");
    await server.http("/text", { method: "POST", chunks: [text.subarray(0, 1), text.subarray(1)] });
    const entry = await server.apiJson("/get-last-request/text");
    expect(entry.request.body).toBe("žluťoučký kůň");
    expect(entry.request.bodyEncoding).toBeUndefined();
  });

  it("returns a binary response file byte for byte", async () => {
    server.writeResponseFile("binary.bin", Buffer.concat([Buffer.from("Content-Type: image/png\r\n\r\n"), BINARY]));
    const result = await server.http("/binaryFile");
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toBe("image/png");
    expect(result.bodyBuffer.equals(BINARY)).toBe(true);
    const entry = await server.apiJson("/get-last-request/binaryFile");
    expect(entry.response.body).toBe(BINARY.toString("base64"));
    expect(entry.response.bodyEncoding).toBe("base64");
  });

  it("passes a binary request body to processors and sends a Buffer set by a processor", async () => {
    const result = await server.http("/binaryProcessor", { method: "POST", body: BINARY });
    expect(result.headers["x-request-binary"]).toBe("true");
    expect(result.headers["content-type"]).toBe("application/octet-stream");
    expect([...result.bodyBuffer]).toStrictEqual([0x00, 0xff, 0xfe, 0x0d, 0x0a, 0x80]);
  });

  it("keeps text requests as strings for processors", async () => {
    const result = await server.http("/binaryProcessor", { method: "POST", body: "text" });
    expect(result.headers["x-request-binary"]).toBe("false");
  });
});
