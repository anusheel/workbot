// Generated from content/entities/location.json by pnpm generate. Edit the description, not this file.
import { z } from "zod";
import { createLocation, listLocations } from "@/lib/entities/location";
import { LocationBody } from "./types";

export async function GET() {
  return Response.json(await listLocations());
}

export async function POST(request: Request) {
  const parsed = LocationBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  return Response.json(await createLocation(parsed.data), { status: 201 });
}
