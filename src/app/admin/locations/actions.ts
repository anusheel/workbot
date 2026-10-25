"use server";

// Generated from content/entities/location.json by pnpm generate. Edit the description, not this file.
import { refresh } from "next/cache";
import { NewLocation, createLocation } from "@/lib/entities/location";

/** A location from the form; an empty field is left to its default. */
export async function createLocationAction(form: FormData) {
  const parsed = NewLocation.safeParse(
    Object.fromEntries([...form.entries()].filter(([, value]) => value !== "")),
  );
  if (!parsed.success) return;
  await createLocation(parsed.data);
  refresh();
}
