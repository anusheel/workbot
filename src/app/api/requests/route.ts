import { z } from "zod";
import { createRequest, listRequests } from "@/lib/requests";
import { RequestBody } from "./types";

export async function GET() {
  return Response.json(await listRequests());
}

export async function POST(request: Request) {
  const parsed = RequestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  return Response.json(await createRequest(parsed.data), { status: 201 });
}
