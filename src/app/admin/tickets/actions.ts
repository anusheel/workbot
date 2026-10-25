"use server";

import { refresh } from "next/cache";
import { githubConnect } from "@/lib/github";
import { withMcp } from "@/lib/mcp";
import { pullTickets } from "@/lib/tickets";
import { syncContacts, syncRequests } from "@/lib/unified";
import { requireUser } from "@/lib/auth";

/** Pulls what changed now, rather than at the next quarter hour. */
export async function syncNow() {
  await requireUser("agent");
  await withMcp(githubConnect, (mcp) => pullTickets(mcp));
  await syncRequests();
  await syncContacts();
  refresh();
}

/** Reads every issue again now, rather than tonight. */
export async function reconcileNow() {
  await requireUser("admin");
  await withMcp(githubConnect, (mcp) => pullTickets(mcp, { full: true }));
  refresh();
}
