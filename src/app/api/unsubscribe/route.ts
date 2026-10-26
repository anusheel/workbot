import { addressOf, suppress } from "@/lib/outreach";

const tokenOf = (request: Request) =>
  new URL(request.url).searchParams.get("token") ?? "";

// A link opened in a browser asks first: mail scanners open links on their own,
// and must not unsubscribe anyone.
export function GET(request: Request) {
  if (!addressOf(tokenOf(request)))
    return new Response("This link is not valid.", { status: 400 });
  return new Response(
    `<!doctype html><form method="post"><p>Stop the emails to this address?</p><button>Unsubscribe</button></form>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// The one click: a mail client posts here (RFC 8058), or the form above does.
export async function POST(request: Request) {
  const address = addressOf(tokenOf(request));
  if (!address) return new Response("This link is not valid.", { status: 400 });
  await suppress(address);
  return new Response("You will get no more emails from us.");
}
