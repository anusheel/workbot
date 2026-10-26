import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

/**
 * Whether a request came from Twilio: it signs the full URL it called
 * followed by every POST parameter, name then value, sorted by name, with
 * HMAC-SHA1 under the account's auth token, in base64.
 */
export function signedByTwilio(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  token: string,
) {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((name) => name + params[name])
      .join("");
  const expected = Buffer.from(
    createHmac("sha1", token).update(data).digest("base64"),
  );
  const given = Buffer.from(signature ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * A webhook's form parameters when Twilio signed them, else nothing. Twilio
 * signs the URL it called, which behind a proxy is the public one, so the
 * check uses the configured address when there is one.
 */
export async function verifiedParams(request: Request, token: string) {
  const form = await request.formData().catch(() => undefined);
  if (!form) return undefined;
  const params = Object.fromEntries(
    [...form].map(([name, value]) => [name, String(value)]),
  );
  const { pathname, search } = new URL(request.url);
  const url = config.appUrl
    ? `${config.appUrl}${pathname}${search}`
    : request.url;
  return signedByTwilio(
    url,
    params,
    request.headers.get("x-twilio-signature"),
    token,
  )
    ? params
    : undefined;
}

/** A send Twilio refused: its HTTP status and error code, and whether trying again could help. */
export class TwilioError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    message: string,
  ) {
    super(`Twilio ${code ?? status}: ${message}`);
  }
  /** Too many requests and the provider's own failures pass; a bad number or a closed window does not. */
  get retryable() {
    return this.status === 429 || this.status >= 500;
  }
}

export type Outgoing = {
  to: string;
  from: string;
  statusCallback?: string;
} & ({ body: string } | { template: string });

/** Sends one message through Twilio's Messaging API; Twilio reports its progress to the status callback. */
export async function sendMessage(message: Outgoing) {
  const { accountSid, authToken, api } = config.twilio;
  if (!accountSid || !authToken)
    throw new TwilioError(401, undefined, "no Twilio account is configured");
  const form = new URLSearchParams({
    To: message.to,
    From: message.from,
    ...(message.statusCallback && { StatusCallback: message.statusCallback }),
    ...("body" in message
      ? { Body: message.body }
      : { ContentSid: message.template }),
  });
  const response = await fetch(
    `${api}/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    },
  );
  const json = (await response.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    code?: number;
    message?: string;
  };
  if (!response.ok || !json.sid)
    throw new TwilioError(
      response.status,
      json.code,
      json.message ?? response.statusText,
    );
  return { sid: json.sid, status: json.status ?? "queued" };
}
