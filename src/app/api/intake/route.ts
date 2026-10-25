import { z } from "zod";
import { track } from "@/lib/analytics";
import { modelFor } from "@/lib/routing";
import { intake } from "@/lib/intake";
import { withTrace } from "@/lib/tracing";
import { IntakeBody } from "./types";

export async function POST(request: Request) {
  const body = IntakeBody.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json(
      { error: z.flattenError(body.error) },
      { status: 400 },
    );
  const created = await withTrace({ tenant: "api", name: "intake" }, () =>
    intake(body.data.message, modelFor("triage")),
  );
  await track("request_submitted", {
    requestId: created.id,
    team: created.team,
    priority: created.priority,
    channel: "api",
  });
  return Response.json(created, { status: 201 });
}
