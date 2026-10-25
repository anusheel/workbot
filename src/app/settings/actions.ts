"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { revokeCredential, saveCredential } from "@/lib/credentials";
import { forget, forgetAll } from "@/lib/memory";
import { memoryOwner } from "@/lib/visitor";

export async function forgetMemory(id: string) {
  const owner = await memoryOwner();
  if (owner) await forget(owner, z.uuid().parse(id));
  refresh();
}

export async function forgetEverything() {
  const owner = await memoryOwner();
  if (owner) await forgetAll(owner);
  refresh();
}

/** Seals the signed-in user's own GitHub token; it is never shown again. */
export async function connect(_: string | undefined, form: FormData) {
  const user = await requireUser("viewer");
  const token = String(form.get("token") ?? "").trim();
  if (token.length < 20) return "That does not look like a GitHub token.";
  await saveCredential(user.id, "github", token);
  refresh();
}

export async function disconnect() {
  const user = await requireUser("viewer");
  await revokeCredential(user.id, "github");
  refresh();
}
