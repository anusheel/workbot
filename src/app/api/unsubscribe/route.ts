import { addressOf, suppress } from "@/lib/outreach";

// The one-click unsubscribe: a mail client posts here (RFC 8058), a person may follow the link.
async function unsubscribe(request: Request) {
  const address = addressOf(
    new URL(request.url).searchParams.get("token") ?? "",
  );
  if (!address) return new Response("This link is not valid.", { status: 400 });
  await suppress(address);
  return new Response("You will get no more emails from us.");
}

export { unsubscribe as GET, unsubscribe as POST };
