import type { Channel } from "./channels";
import { config } from "./config";
import { query } from "./db";
import { TwilioError, sendMessage } from "./twilio";

export type OutboundMessage = {
  id: string;
  channel: Channel;
  address: string;
  body: string;
  status: string;
  sid: string | null;
  attempts: number;
  error: string | null;
  updatedAt: Date;
};

const columns = `id, channel, address, body, status, sid, attempts, error, updated_at as "updatedAt"`;
const day = 86_400_000;

/** WhatsApp lets a business write freely for 24 hours after the customer's last message; after that, only an approved template. */
export const windowOpen = (lastInbound: Date | null, now = new Date()) =>
  !!lastInbound && now.getTime() - lastInbound.getTime() < day;

/** A message to send, kept before it is sent so a retry finds it; `inbound` names the message it answers. */
export async function queue(
  channel: Channel,
  address: string,
  body: string,
  inbound?: string,
) {
  const [row] = await query<{ id: string }>(
    `insert into outbound (channel, address, body, inbound) values ($1, $2, $3, $4) returning id`,
    [channel, address, body, inbound ?? null],
  );
  return row.id;
}

/** A send that could not go and will not go on retrying: the row says why. */
export class Undeliverable extends Error {}

const fail = async (id: string, reason: string) => {
  await query(
    `update outbound set status = 'failed', error = $2, updated_at = now() where id = $1`,
    [id, reason],
  );
  return new Undeliverable(reason);
};

/**
 * Sends a queued message once. A message already handed to the provider is
 * not sent again, so a retried step cannot double it. A recipient who opted
 * out gets nothing, and WhatsApp outside its 24-hour window gets the approved
 * template or nothing. A failure the provider may recover from is recorded
 * and thrown, for the caller to retry; any other fails the message for good.
 */
export async function deliver(id: string) {
  const [message] = await query<
    OutboundMessage & { lastInbound: Date | null; optedOut: boolean }
  >(
    `select o.id, o.channel, o.address, o.body, o.sid, c.last_inbound_at as "lastInbound", c.opted_out_at is not null as "optedOut"
     from outbound o left join channels c on c.channel = o.channel and c.address = o.address where o.id = $1`,
    [id],
  );
  if (!message) throw await fail(id, "no such message");
  if (message.sid) return message.sid;
  if (message.optedOut) throw await fail(id, "the recipient opted out");
  const whatsapp = message.channel === "whatsapp";
  const from = whatsapp
    ? config.twilio.whatsappFrom && `whatsapp:${config.twilio.whatsappFrom}`
    : config.twilio.smsFrom;
  if (!from) throw await fail(id, `no ${message.channel} number is configured`);
  const content =
    !whatsapp || windowOpen(message.lastInbound)
      ? { body: message.body }
      : config.twilio.whatsappTemplate
        ? { template: config.twilio.whatsappTemplate }
        : undefined;
  if (!content)
    throw await fail(
      id,
      "outside WhatsApp's 24-hour window, and no approved template is configured",
    );
  try {
    const { sid, status } = await sendMessage({
      to: whatsapp ? `whatsapp:${message.address}` : message.address,
      from,
      statusCallback:
        config.appUrl && `${config.appUrl}/api/webhooks/twilio/status`,
      ...content,
    });
    await query(
      `update outbound set sid = $2, status = $3, attempts = attempts + 1, error = null, updated_at = now() where id = $1`,
      [id, sid, status],
    );
    return sid;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (error instanceof TwilioError && error.retryable) {
      await query(
        `update outbound set attempts = attempts + 1, error = $2, updated_at = now() where id = $1`,
        [id, reason],
      );
      throw error;
    }
    throw await fail(id, reason);
  }
}

/** Twilio's word on a message it was given: queued, sent, delivered, read, undelivered or failed, with its error code. */
export async function updateStatus(
  sid: string,
  status: string,
  errorCode?: string,
) {
  await query(
    `update outbound set status = $2, error = coalesce($3, error), updated_at = now() where sid = $1`,
    [sid, status, errorCode ? `Twilio ${errorCode}` : null],
  );
}

/** A run that gave up: what it queued in answer to the message and did not send is marked failed. */
export const failUnsent = (inbound: string, reason: string) =>
  query(
    `update outbound set status = 'failed', error = $2, updated_at = now() where inbound = $1 and sid is null and status = 'queued'`,
    [inbound, reason],
  );

export const listOutbound = (limit = 20) =>
  query<OutboundMessage>(
    `select ${columns} from outbound order by created_at desc limit $1`,
    [limit],
  );
