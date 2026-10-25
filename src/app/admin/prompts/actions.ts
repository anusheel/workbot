"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { addVersion, setShares } from "@/lib/prompts";

const Version = z.object({
  name: z.string().min(1),
  text: z.string().trim().min(20),
  note: z.string().trim().max(200).default(""),
});

/** A new version of a prompt, off traffic until a share is set. */
export async function createVersion(formData: FormData) {
  const input = Version.parse(Object.fromEntries(formData));
  await addVersion(input.name, input.text, input.note);
  refresh();
}

/** The traffic split: one share per version, from the fields named share-<version>. */
export async function splitTraffic(name: string, formData: FormData) {
  const shares: Record<number, number> = {};
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^share-(\d+)$/);
    if (match)
      shares[Number(match[1])] = z.coerce
        .number()
        .int()
        .min(0)
        .max(100)
        .parse(value);
  }
  await setShares(name, shares);
  refresh();
}
