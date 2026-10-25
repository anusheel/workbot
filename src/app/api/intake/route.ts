import { z } from "zod";
import { track } from "@/lib/analytics";
import { chatModel } from "@/lib/chat";
import { intake } from "@/lib/intake";
import { IntakeBody } from "./types";

export async function POST(request: Request) {
  const body = IntakeBody.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json(
      { error: z.flattenError(body.error) },
      { status: 400 },
    );
  const created = await intake(body.data.message, chatModel("small"));
  await track("request_submitted", {
    requestId: created.id,
    team: created.team,
    priority: created.priority,
    channel: "api",
  });
  return Response.json(created, { status: 201 });
}
