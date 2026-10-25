import type { UIMessage } from "ai";
import { z } from "zod";

/** A chat kept in the browser: the id useChat runs under, a title from its first question, and its messages. */
export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

const key = "workbot.conversations";
const none: Conversation[] = [];
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Conversation[] } = {
  raw: null,
  value: none,
};

// The store behind useSyncExternalStore: localStorage, read through a cache
// so an unchanged list is the same array, and written through a notify.
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConversations(): Conversation[] {
  const raw = localStorage.getItem(key);
  if (raw !== cached.raw) cached = { raw, value: parse(raw) };
  return cached.value;
}

export const getServerConversations = () => none;

export function saveConversations(conversations: Conversation[]) {
  // The list is most recent first, so a full store gives up the tail.
  let kept = conversations;
  while (!write(kept) && kept.length > 0) kept = kept.slice(0, -1);
  for (const listener of listeners) listener();
}

function write(conversations: Conversation[]) {
  try {
    localStorage.setItem(key, JSON.stringify(conversations));
    return true;
  } catch {
    return false;
  }
}

// The messages are the AI SDK's to describe; the list only needs to be one.
const stored = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    updatedAt: z.number(),
    messages: z.array(z.unknown()),
  }),
);

function parse(raw: string | null): Conversation[] {
  try {
    const list = stored.safeParse(raw ? JSON.parse(raw) : none);
    return list.success ? (list.data as Conversation[]) : none;
  } catch {
    return none;
  }
}

/** The list with one conversation's messages replaced or added, most recent first. */
export function upsert(
  conversations: Conversation[],
  id: string,
  messages: UIMessage[],
  now = Date.now(),
): Conversation[] {
  const title =
    conversations.find((c) => c.id === id)?.title || titleOf(messages);
  return [
    { id, title, updatedAt: now, messages },
    ...conversations.filter((c) => c.id !== id),
  ];
}

export function titleOf(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text =
    first?.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim() ?? "";
  return text.length > 48 ? `${text.slice(0, 47)}…` : text || "New chat";
}
