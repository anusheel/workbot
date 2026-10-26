import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { query } from "./db";

// The sequence: three short emails over two weeks to an account's published
// contact address, stopped by any reply and by an unsubscribe.
export const sequence = [
  {
    day: 0,
    subject: "Orders by text at {account}",
    body: "Contractors text and call {account} with orders and questions, and someone types each one in. WorkBot files them, answers the routine ones from your own policies, and reads suppliers' invoices into records for finance. Worth 20 minutes to see it on your own documents?",
  },
  {
    day: 4,
    subject: "Re: Orders by text at {account}",
    body: "A building-supply company much like {account}, one warehouse and six vans, uses it for its operations, finance and support teams. It runs at about $180 a month for 1,000 users. Shall I send the two-page summary?",
  },
  {
    day: 11,
    subject: "Closing the loop",
    body: "I'll leave it here. If the orders desk at {account} ever wants to try it, reply and I'll set it up on a few of your own documents.",
  },
];

/** Signs an address for a one-click unsubscribe link, so the link cannot be forged for anyone else. */
export function unsubscribeToken(address: string) {
  if (!config.secrets.key)
    throw new Error(
      "SECRETS_KEY signs unsubscribe links; set it before sending",
    );
  const mac = createHmac("sha256", config.secrets.key)
    .update(address.toLowerCase())
    .digest("base64url");
  return `${Buffer.from(address.toLowerCase()).toString("base64url")}.${mac}`;
}

/** The address a token was signed for, or undefined when it was not signed by this deployment. */
export function addressOf(token: string) {
  const [encoded = ""] = token.split(".");
  const address = Buffer.from(encoded, "base64url").toString();
  const expected = Buffer.from(unsubscribeToken(address));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? address
    : undefined;
}

/**
 * One email of the sequence, with what every commercial email must carry: who
 * sent it, a postal address, and a way out that works in one click.
 */
export function compose(
  step: number,
  account: string,
  address: string,
  sender: { name: string; postal: string; url: string },
) {
  const { subject, body } = sequence[step];
  const link = `${sender.url}/api/unsubscribe?token=${unsubscribeToken(address)}`;
  return {
    to: address,
    subject: subject.replaceAll("{account}", account),
    text: `${body.replaceAll("{account}", account)}\n\n${sender.name}\n${sender.postal}\nNo more emails: ${link}`,
    headers: {
      "List-Unsubscribe": `<${link}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** The step due for an address today, or undefined when it replied, unsubscribed, or the sequence is done. */
export async function due(
  address: string,
  startedOn: Date,
  sent: number,
  replied: boolean,
  today = new Date(),
) {
  const [suppressed] = await query(
    `select 1 from suppressions where address = lower($1)`,
    [address],
  );
  if (replied || suppressed || sent >= sequence.length) return undefined;
  const days = Math.floor((today.getTime() - startedOn.getTime()) / 86_400_000);
  return days >= sequence[sent].day ? sent : undefined;
}

export const suppress = (address: string) =>
  query(
    `insert into suppressions (address) values (lower($1)) on conflict do nothing`,
    [address],
  );
