import { z } from "zod";
import { authorized } from "@/lib/auth";
import { getItem } from "@/lib/inbox";

/** A document's progress through the workflow, for the integration that sent it to poll. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/documents/[id]">,
) {
  const user = await authorized(request, "agent");
  if (user instanceof Response) return user;
  const id = z.uuid().safeParse((await ctx.params).id);
  const item = id.success ? await getItem(id.data) : undefined;
  if (!item)
    return Response.json({ error: "no such document" }, { status: 404 });
  const { status, type, review, requestId } = item;
  return Response.json({ id: item.id, status, type, review, requestId });
}
