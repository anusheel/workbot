import { expect, test, vi } from "vitest";
import { standInTwilio } from "@/test/twilio";
import { respond } from "./channels";
import { config } from "./config";
import { query } from "./db";
import {
  Undeliverable,
  deliver,
  queue,
  updateStatus,
  windowOpen,
} from "./outbound";
import { TwilioError } from "./twilio";

vi.hoisted(() => {
  process.env.TWILIO_ACCOUNT_SID = "AC0000";
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.TWILIO_SMS_FROM = "+15105550000";
  process.env.TWILIO_WHATSAPP_FROM = "+15105550001";
});

const { answers, received } = standInTwilio();

const status = async (id: string) =>
  (
    await query<{ status: string; attempts: number; error: string | null }>(
      `select status, attempts, error from outbound where id = $1`,
      [id],
    )
  )[0];

test("a message is sent once, however often its step runs", async () => {
  const id = await queue("sms", "+15105550142", "Your order ships Friday.");
  const before = received.length;
  const sid = await deliver(id);
  expect(await deliver(id)).toBe(sid);
  expect(received.length - before).toBe(1);
  expect(received.at(-1)?.get("Body")).toBe("Your order ships Friday.");
  await updateStatus(sid, "delivered");
  expect((await status(id)).status).toBe("delivered");
});

test("a provider failure is retried and reported; a bad number fails for good", async () => {
  const id = await queue("sms", "+15105550142", "Retry me.");
  answers.push({
    status: 503,
    body: { code: 20500, message: "Service unavailable" },
  });
  const first = await deliver(id).catch((error: unknown) => error);
  expect(first).toBeInstanceOf(TwilioError);
  expect((first as TwilioError).retryable).toBe(true);
  expect(await status(id)).toMatchObject({ status: "queued", attempts: 1 });
  await deliver(id);
  expect(await status(id)).toMatchObject({
    status: "queued",
    attempts: 2,
    error: null,
  });

  const bad = await queue("sms", "+1555", "Nowhere.");
  answers.push({
    status: 400,
    body: { code: 21211, message: "Invalid 'To' Phone Number" },
  });
  await expect(deliver(bad)).rejects.toBeInstanceOf(Undeliverable);
  expect(await status(bad)).toMatchObject({
    status: "failed",
    error: "Twilio 21211: Invalid 'To' Phone Number",
  });
});

test("WhatsApp writes freely for 24 hours after the customer, then only with an approved template", async () => {
  expect(windowOpen(new Date(Date.now() - 23 * 3600_000))).toBe(true);
  expect(windowOpen(new Date(Date.now() - 25 * 3600_000))).toBe(false);
  const address = "+15105550177";
  await respond({ channel: "whatsapp", address, text: "STOP" });
  await respond({ channel: "whatsapp", address, text: "START" });
  await query(
    `update channels set last_inbound_at = now() - interval '25 hours' where address = $1`,
    [address],
  );
  const late = await queue("whatsapp", address, "Your request was updated.");
  await expect(deliver(late)).rejects.toThrow(
    "outside WhatsApp's 24-hour window",
  );

  config.twilio.whatsappTemplate = "HX0123";
  const templated = await queue(
    "whatsapp",
    address,
    "Your request was updated.",
  );
  await deliver(templated);
  expect(received.at(-1)?.get("ContentSid")).toBe("HX0123");
  expect(received.at(-1)?.get("Body")).toBeNull();
  expect(received.at(-1)?.get("To")).toBe(`whatsapp:${address}`);
});

test("nothing goes to a number that opted out", async () => {
  const address = "+15105550188";
  await respond({ channel: "sms", address, text: "STOP" });
  const id = await queue("sms", address, "Hello again.");
  await expect(deliver(id)).rejects.toThrow("opted out");
});
