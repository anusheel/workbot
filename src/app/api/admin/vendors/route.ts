// Generated from content/entities/vendor.json by pnpm generate. Edit the description, not this file.
import { z } from "zod";
import { createVendor, listVendors } from "@/lib/entities/vendor";
import { VendorBody } from "./types";

export async function GET() {
  return Response.json(await listVendors());
}

export async function POST(request: Request) {
  const parsed = VendorBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  return Response.json(await createVendor(parsed.data), { status: 201 });
}
