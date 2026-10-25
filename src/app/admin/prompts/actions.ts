"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { addVersion, setShares } from "@/lib/prompts";
import { requireUser } from "@/lib/auth";

const Version = z.object({
  name: z.string().min(1),
  text: z.string().trim().min(20),
  note: z.string().trim().max(200).default(""),
});

export type VersionState = {
  errors?: { text?: string[]; note?: string[] };
  text?: string;
  note?: string;
};

export type SplitState = {
  message?: string;
  shares?: Record<number, string>;
};

/** A new version of a prompt, off traffic until a share is set. */
export async function createVersion(
  _: VersionState,
  formData: FormData,
): Promise<VersionState> {
  await requireUser("admin");
  const parsed = Version.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      errors: z.flattenError(parsed.error).fieldErrors,
      text: String(formData.get("text") ?? ""),
      note: String(formData.get("note") ?? ""),
    };
  await addVersion(parsed.data.name, parsed.data.text, parsed.data.note);
  refresh();
  return {};
}

/** The traffic split: one share per version, from the fields named share-<version>. */
export async function splitTraffic(
  name: string,
  _: SplitState,
  formData: FormData,
): Promise<SplitState> {
  await requireUser("admin");
  const entered: Record<number, string> = {};
  const shares: Record<number, number> = {};
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^share-(\d+)$/);
    if (!match) continue;
    entered[Number(match[1])] = String(value);
    const share = z.coerce.number().int().min(0).max(100).safeParse(value);
    if (!share.success)
      return {
        message: "Each share is a whole number from 0 to 100.",
        shares: entered,
      };
    shares[Number(match[1])] = share.data;
  }
  const total = Object.values(shares).reduce((sum, share) => sum + share, 0);
  if (total !== 100)
    return { message: `Shares add up to ${total}, not 100.`, shares: entered };
  await setShares(name, shares);
  refresh();
  return {};
}
