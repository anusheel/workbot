"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import {
  documentReceived,
  documentReviewed,
  remindersRequested,
} from "@/inngest/events";
import { type MediaType, fileSizeError, mediaTypes } from "@/lib/extract";
import { discard, receive } from "@/lib/inbox";
import { requireUser } from "@/lib/auth";

const media = new Set<string>(Object.values(mediaTypes));

/** Each file lands in the inbox and starts its own run of the approval workflow. */
export async function uploadDocuments(formData: FormData) {
  await requireUser("agent");
  const files = formData
    .getAll("documents")
    .filter((f): f is File => f instanceof File && media.has(f.type))
    .slice(0, 10);
  for (const file of files) {
    const tooBig = fileSizeError(file.size);
    if (tooBig) throw new Error(`${file.name}: ${tooBig}`);
  }
  const items = await Promise.all(
    files.map(async (file) =>
      receive(
        file.name,
        file.type as MediaType,
        new Uint8Array(await file.arrayBuffer()),
      ),
    ),
  );
  if (items.length === 0) return;
  // The rows and their events go together: an upload the engine never heard of is removed, not stranded.
  await inngest
    .send(items.map((item) => documentReceived.create({ id: item.id })))
    .catch(async (error: unknown) => {
      await discard(items.map((item) => item.id));
      throw error;
    });
  refresh();
}

/** The reviewer's answer, as the event the waiting run is listening for. */
export async function review(id: string, decision: string) {
  await requireUser("agent");
  await inngest.send(
    documentReviewed.create({
      id: z.uuid().parse(id),
      decision: z.enum(["approved", "rejected"]).parse(decision),
    }),
  );
  refresh();
}

export async function runReminders() {
  await requireUser("admin");
  await inngest.send(remindersRequested.create({}));
  refresh();
}
