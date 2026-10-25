"use server";

import { refresh } from "next/cache";
import { githubConnect } from "@/lib/github";
import { withMcp } from "@/lib/mcp";
import { pullTickets } from "@/lib/tickets";

/** Pulls what changed now, rather than at the next quarter hour. */
export async function syncNow() {
  await withMcp(githubConnect, pullTickets);
  refresh();
}
