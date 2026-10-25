"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { forget, forgetAll } from "@/lib/memory";
import { visitorId } from "@/lib/visitor";

export async function forgetMemory(id: string) {
  const visitor = await visitorId();
  if (visitor) await forget(visitor, z.uuid().parse(id));
  refresh();
}

export async function forgetEverything() {
  const visitor = await visitorId();
  if (visitor) await forgetAll(visitor);
  refresh();
}
