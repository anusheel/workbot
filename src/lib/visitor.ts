import { cookies } from "next/headers";
import { currentUser } from "./auth";

/**
 * The anonymous id the proxy gives every browser. A caller without one (the
 * API reached directly) has no identity, so nothing personal is kept for it.
 */
export async function visitorId(): Promise<string | undefined> {
  return (await cookies()).get("visitor")?.value;
}

/** Whose memory a request reads and writes: a signed-in user's follows them to any browser; a visitor's stays in the one that holds the cookie. */
export async function memoryOwner(): Promise<string | undefined> {
  return (await currentUser())?.id ?? (await visitorId());
}
