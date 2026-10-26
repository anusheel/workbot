import { userOf } from "@/lib/auth";
import { historyOf } from "@/lib/history";
import { visitorId } from "@/lib/visitor";

/** The server's copy of a conversation, which holds the turns taken on other channels; only to the person whose it is. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/conversations/[id]">,
) {
  const person = (await userOf(request.headers))?.id ?? (await visitorId());
  const history = person && (await historyOf((await ctx.params).id, person));
  if (!history)
    return Response.json({ error: "no such conversation" }, { status: 404 });
  return Response.json({ messages: history.messages });
}
