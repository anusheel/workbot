import { config } from "./config";
import { query } from "./db";

const TIMEOUT_MS = 2000;

/** Whether the database answers, and the commit this server runs. */
export async function health() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The driver waits up to 30 seconds to connect, so the check gives up first.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
  });
  const database = await Promise.race([query("select 1"), timeout]).then(
    () => "ok" as const,
    () => "unreachable" as const,
  );
  clearTimeout(timer);
  return {
    status: database === "ok" ? ("ok" as const) : ("degraded" as const),
    database,
    commit: config.commit,
  };
}
