import { z } from "zod";
import { track } from "@/lib/analytics";
import { modelFor } from "@/lib/routing";
import { intake } from "@/lib/intake";
import { withTrace } from "@/lib/tracing";
import { IntakeBody } from "./types";
import { authorized } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await authorized(request, "agent");
  if (user instanceof Response) return user;
  const body = IntakeBody.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json(
      { error: z.flattenError(body.error) },
      { status: 400 },
    );
  const created = await withTrace(
    { caller: user.id, role: user.role, user: user.id, name: "intake" },
    () => intake(body.data.message, modelFor("triage")),
  );
  await track("request_submitted", {
    requestId: created.id,
    team: created.team,
    priority: created.priority,
    channel: "api",
  });
  return Response.json(created, { status: 201 });
}
