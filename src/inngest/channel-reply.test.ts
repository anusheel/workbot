import { InngestTestEngine } from "@inngest/test";
import { expect, test, vi } from "vitest";
import { query } from "@/lib/db";
import { standInTwilio } from "@/test/twilio";
import { channelReply } from "./channel-reply";

vi.hoisted(() => {
  process.env.TWILIO_ACCOUNT_SID = "AC0000";
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.TWILIO_SMS_FROM = "+15105550000";
  process.env.TWILIO_WHATSAPP_FROM = "+15105550001";
});

const { received } = standInTwilio();

// The model's turn and the learning after it are mocked by id; the queue and the send run for real.
const run = (channel: "sms" | "whatsapp", sid: string, reply: unknown) =>
  new InngestTestEngine({
    function: channelReply,
    events: [
      {
        name: "channel/message.received",
        data: { channel, address: "+15105550142", text: "Friday?", sid },
      },
    ],
  }).execute({
    steps: [
      { id: "reply", handler: () => reply },
      { id: "learn", handler: () => undefined },
    ],
  });

const sent = (inbound: string) =>
  query<{
    status: string;
    sid: string | null;
    body: string;
    error: string | null;
  }>(`select status, sid, body, error from outbound where inbound = $1`, [
    inbound,
  ]);

test("a text message's reply is queued under the message it answers and sent once", async () => {
  const before = received.length;
  const { result } = await run("sms", "SM-in-1", {
    text: "Yes, Friday at 9.",
    tools: [],
    turn: { person: "sms:+15105550142", conversation: "sms:+15105550142" },
  });
  expect(result).toEqual({ sent: true });
  expect(received.length - before).toBe(1);
  expect(received.at(-1)?.get("To")).toBe("+15105550142");
  expect(await sent("SM-in-1")).toEqual([
    {
      status: "queued",
      sid: expect.stringMatching(/^SM/),
      body: "Yes, Friday at 9.",
      error: null,
    },
  ]);
});

test("a sender who opted out gets nothing", async () => {
  const { result } = await run("sms", "SM-in-2", undefined);
  expect(result).toEqual({ sent: false });
  expect(await sent("SM-in-2")).toEqual([]);
});

test("a reply WhatsApp will not take is failed with its reason, not retried", async () => {
  // A number that never wrote has no open window, and no template is configured.
  const { error } = await run("whatsapp", "SM-in-3", {
    text: "Hello.",
    tools: [],
  });
  expect(error).toMatchObject({
    name: "NonRetriableError",
    message: expect.stringMatching(/24-hour window/),
  });
  expect(await sent("SM-in-3")).toEqual([
    expect.objectContaining({
      status: "failed",
      error: expect.stringMatching(/24-hour window/),
    }),
  ]);
});
