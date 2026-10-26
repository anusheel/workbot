"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import {
  dispatchRequested,
  documentReceived,
  messageReceived,
} from "@/inngest/events";
import { requireUser } from "@/lib/auth";
import {
  type DeadLetter,
  claimForReplay,
  releaseReplay,
} from "@/lib/dead-letters";
import { type DomainEvent, redeliver } from "@/lib/events";
import { updateItem } from "@/lib/inbox";

/** Sends a dead letter back where it came from, once; whoever does it has fixed, or accepted, the cause. */
export async function replay(id: string) {
  await requireUser("admin");
  const letter = await claimForReplay(z.uuid().parse(id));
  if (!letter) return refresh();
  try {
    await sendBack(letter);
  } catch (error) {
    // A replay that failed leaves the letter where it was, for another try.
    await releaseReplay(letter.id);
    throw error;
  }
  refresh();
}

async function sendBack(letter: DeadLetter) {
  const { data } = letter.payload as { data: Record<string, unknown> };
  if (letter.source === "job:document") {
    const { id: item, owner } = documentReceived.schema.parse(data);
    await updateItem(item, { status: "received" });
    await inngest.send(documentReceived.create({ id: item, owner }));
  } else if (letter.source === "job:channel-reply") {
    const message = messageReceived.schema.parse(data);
    // A new event id, since the engine drops a repeat of the original for a day.
    await inngest.send(
      messageReceived.create(message, { id: `${message.sid}:${letter.id}` }),
    );
  } else if (letter.source.startsWith("event:")) {
    await redeliver(
      letter.source.slice("event:".length),
      letter.payload as DomainEvent,
    );
  }
}

/** Hands the domain events to their consumers now. */
export async function dispatchNow() {
  await requireUser("admin");
  await inngest.send(dispatchRequested.create({}));
  refresh();
}
