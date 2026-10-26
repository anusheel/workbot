import { createHmac } from "node:crypto";
import { expect, test, vi } from "vitest";
import { POST } from "./route";

vi.hoisted(() => {
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
  process.env.SLACK_SIGNING_SECRET = "slack-secret";
});

// How Slack signs: v0, the timestamp and the raw body, under the app's signing secret.
const post = (body: string, secret = "slack-secret") => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  return POST(
    new Request("http://localhost:3000/api/webhooks/slack", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signature,
      },
      body,
    }),
  );
};

test("Slack's check of a new events address is answered with its challenge", async () => {
  const response = await post(
    JSON.stringify({
      type: "url_verification",
      challenge: "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P",
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toContain(
    "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P",
  );
});

test("an event Slack did not sign is refused", async () => {
  const response = await post(
    JSON.stringify({ type: "url_verification", challenge: "x" }),
    "guessed",
  );
  expect(response.status).toBe(401);
});
