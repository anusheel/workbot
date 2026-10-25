"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  createUser,
  issueKey,
  requireUser,
  revokeKey,
  roles,
} from "@/lib/auth";
import { type Provider, revokeCredential } from "@/lib/credentials";

export type Issued = { name?: string; key?: string; error?: string };

const NewUser = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.enum(roles),
});

/** A new person or service; its key is shown once, here, and never again. */
export async function addUser(_: Issued, form: FormData): Promise<Issued> {
  await requireUser("admin");
  const parsed = NewUser.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "A name of 2 to 80 characters and a role." };
  const { user, key } = await createUser(parsed.data.name, parsed.data.role);
  refresh();
  return { name: user.name, key };
}

/** Another key for a user: the old ones keep working until revoked. */
export async function addKey(userId: string, name: string): Promise<Issued> {
  await requireUser("admin");
  const key = await issueKey(userId);
  refresh();
  return { name, key };
}

export async function revoke(keyId: string) {
  await requireUser("admin");
  await revokeKey(keyId);
  refresh();
}

/** Revokes a user's sealed token for an integration. */
export async function disconnectUser(userId: string, provider: Provider) {
  await requireUser("admin");
  await revokeCredential(userId, provider);
  refresh();
}
