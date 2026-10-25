"use server";

// Generated from content/entities/vendor.json by pnpm generate. Edit the description, not this file.
import { refresh } from "next/cache";
import { NewVendor, createVendor } from "@/lib/entities/vendor";

/** A vendor from the form; an empty field is left to its default. */
export async function createVendorAction(form: FormData) {
  const parsed = NewVendor.safeParse(
    Object.fromEntries([...form.entries()].filter(([, value]) => value !== "")),
  );
  if (!parsed.success) return;
  await createVendor(parsed.data);
  refresh();
}
