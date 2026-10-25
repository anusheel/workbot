import { connection } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
  // Answer from the running server, not from the prerendered build.
  await connection();
  return Response.json({ status: "ok", commit: config.commit });
}
