import { createServer } from "node:http";
import { afterAll, beforeAll } from "vitest";
import { config } from "@/lib/config";

/**
 * A stand-in for Twilio's Messaging API on this machine, for the tests of
 * code that sends: each send gets the next scripted answer, or a new message
 * id, and what was sent is kept. The app reaches it through the API host
 * setting, as it would reach a regional Twilio host.
 */
export function standInTwilio() {
  const answers: { status: number; body: object }[] = [];
  const received: URLSearchParams[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push(new URLSearchParams(body));
      const { status, body: json } = answers.shift() ?? {
        status: 201,
        body: { sid: `SM${received.length}`, status: "queued" },
      };
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  beforeAll(async () => {
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const { port } = server.address() as { port: number };
    config.twilio.api = `http://127.0.0.1:${port}`;
  });
  afterAll(() => server.close());
  return { answers, received };
}
