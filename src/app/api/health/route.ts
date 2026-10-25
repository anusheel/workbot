import { connection } from "next/server";
import { config } from "@/lib/config";
import { query } from "@/lib/db";

export async function GET() {
  // Answer from the running server, not from the prerendered build.
  await connection();
  const database = await query("select 1").then(
    () => "ok",
    () => "unreachable",
  );
  const ok = database === "ok";
  return Response.json(
    { status: ok ? "ok" : "degraded", database, commit: config.commit },
    { status: ok ? 200 : 503 },
  );
}
