import { config } from "./config";
import { query } from "./db";

/** Whether the database answers, and the commit this server runs. */
export async function health() {
  const database = await query("select 1").then(
    () => "ok" as const,
    () => "unreachable" as const,
  );
  return {
    status: database === "ok" ? ("ok" as const) : ("degraded" as const),
    database,
    commit: config.commit,
  };
}
