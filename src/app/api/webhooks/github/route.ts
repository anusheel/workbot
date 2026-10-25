import { z } from "zod";
import { deliverySigned } from "@/lib/github";
import { repository } from "@/lib/tickets";
import { fromIssue, logSync, upsertTicket } from "@/lib/unified";
import { IssuesEvent } from "./types";

/** The body as JSON, or nothing, which the schema then refuses. */
const parsed = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

/** The push path: an issue changed, so its row is replaced now rather than at the next pull. */
export async function POST(request: Request) {
  const body = await request.text();
  if (!deliverySigned(body, request.headers.get("x-hub-signature-256")))
    return new Response(null, { status: 401 });
  if (request.headers.get("x-github-event") !== "issues")
    return new Response(null, { status: 204 });
  const event = IssuesEvent.safeParse(parsed(body));
  if (!event.success)
    return Response.json(z.flattenError(event.error), { status: 400 });
  const { slug } = repository();
  if (event.data.repository.full_name !== slug)
    return new Response(null, { status: 204 });
  const ticket = fromIssue(slug, event.data.issue);
  await upsertTicket(ticket);
  await logSync(
    "github",
    ticket.key,
    "webhook",
    Date.now() - ticket.updatedAt.getTime(),
  );
  return new Response(null, { status: 204 });
}
