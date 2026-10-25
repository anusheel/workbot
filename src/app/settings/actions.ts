"use server";

import { refresh } from "next/cache";
import { z } from "zod";
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
