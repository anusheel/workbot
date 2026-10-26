"use server";

import { z } from "zod";
import { linkCode } from "@/lib/channels";
import { memoryOwner } from "@/lib/visitor";

/** A code that continues this conversation on the phone that sends it. */
export async function linkPhone(conversationId: string) {
  const person = await memoryOwner();
  if (!person) throw new Error("This browser has no session to link.");
  return linkCode(person, z.string().min(1).max(100).parse(conversationId));
}
