import { createHmac } from "node:crypto";
import { expect, test, vi } from "vitest";
import { query } from "@/lib/db";
import { queue } from "@/lib/outbound";
import { POST } from "./route";

vi.hoisted(() => {
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.APP_URL = "https://workbot.example";
});

const post = (params: Record<string, string>) => {
  const data =
    "https://workbot.example/api/webhooks/twilio/status" +
    Object.keys(params)
      .sort()
      .map((name) => name + params[name])
      .join("");
  return POST(
    new Request("http://localhost:3000/api/webhooks/twilio/status", {
      method: "POST",
      headers: {
        "x-twilio-signature": createHmac("sha1", "token")
          .update(data)
          .digest("base64"),
      },
      body: new URLSearchParams(params),
    }),
  );
};

test("Twilio's status reports move the message along, with the error code of a failure", async () => {
  const id = await queue("sms", "+15105550142", "On its way.");
  await query(`update outbound set sid = 'SM900' where id = $1`, [id]);
  expect(
    (await post({ MessageSid: "SM900", MessageStatus: "sent" })).status,
  ).toBe(204);
  expect(
    (
      await post({
        MessageSid: "SM900",
        MessageStatus: "undelivered",
        ErrorCode: "30003",
      })
    ).status,
  ).toBe(204);
  const [row] = await query<{ status: string; error: string }>(
    `select status, error from outbound where id = $1`,
    [id],
  );
  expect(row).toEqual({ status: "undelivered", error: "Twilio 30003" });
});
