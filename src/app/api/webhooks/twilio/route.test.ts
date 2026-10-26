import { createHmac } from "node:crypto";
import { expect, test, vi } from "vitest";
import { inngest } from "@/inngest/client";
import { POST } from "./route";

vi.hoisted(() => {
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.APP_URL = "https://workbot.example";
});
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

const url = "https://workbot.example/api/webhooks/twilio";
// How Twilio signs: the URL, then each parameter's name and value, sorted by name.
const sign = (params: Record<string, string>, token = "token") =>
  createHmac("sha1", token)
    .update(
      url +
        Object.keys(params)
          .sort()
          .map((name) => name + params[name])
          .join(""),
    )
    .digest("base64");

// The request arrives at the server's own address; the signature is over the public one.
const post = (params: Record<string, string>, signature = sign(params)) =>
  POST(
    new Request("http://localhost:3000/api/webhooks/twilio", {
      method: "POST",
      headers: { "x-twilio-signature": signature },
      body: new URLSearchParams(params),
    }),
  );

test("a signed WhatsApp message goes to the workflow under Twilio's id, and Twilio gets empty TwiML at once", async () => {
  const params = {
    MessageSid: "SM123",
    From: "whatsapp:+15105550142",
    To: "whatsapp:+15105550001",
    Body: "Is my order still on for Friday?",
  };
  const response = await post(params);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("<Response/>");
  expect(vi.mocked(inngest.send)).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "SM123",
      data: {
        channel: "whatsapp",
        address: "+15105550142",
        text: "Is my order still on for Friday?",
        sid: "SM123",
      },
    }),
  );
});

test("a request Twilio did not sign is refused before anything runs", async () => {
  vi.mocked(inngest.send).mockClear();
  const params = { MessageSid: "SM124", From: "+15105550142", Body: "hi" };
  expect((await post(params, sign(params, "guessed"))).status).toBe(403);
  expect((await post(params, "")).status).toBe(403);
  expect(
    (await post({ ...params, Body: "changed" }, sign(params))).status,
  ).toBe(403);
  expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
});
