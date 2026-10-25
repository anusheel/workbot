import { connection } from "next/server";
import { health } from "@/lib/health";

export async function GET() {
  // Answer from the running server, not from the prerendered build.
  await connection();
  const report = await health();
  return Response.json(report, { status: report.status === "ok" ? 200 : 503 });
}
