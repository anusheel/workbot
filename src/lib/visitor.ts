import { cookies } from "next/headers";

/**
 * The anonymous id the proxy gives every browser. A caller without one (the
 * API reached directly) has no identity, so nothing personal is kept for it.
 */
export async function visitorId(): Promise<string | undefined> {
  return (await cookies()).get("visitor")?.value;
}
