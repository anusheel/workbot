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
  const entries = conversations.map((c) => JSON.stringify(c));
  const fits = (count: number) =>
    write(`[${entries.slice(0, count).join(",")}]`);
  if (!fits(conversations.length)) {
    // The list is most recent first, so a full store gives up the tail, and
    // the longest list that fits is found by halving. The newest chat is never
    // given up: a refused write leaves the stored list as it was, so when the
    // newest alone does not fit, the last list that did fit stays.
    let low = 1;
    let high = conversations.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fits(mid)) low = mid + 1;
      else high = mid - 1;
    }
  }
  for (const listener of listeners) listener();
}

function write(json: string) {
  try {
    localStorage.setItem(key, json);
    return true;
  } catch {
    return false;
  }
}

// The messages are the AI SDK's to describe; a conversation only needs messages
// that the page can render, which have an id, a role and parts that have a type.
const stored = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.number(),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["system", "user", "assistant"]),
      parts: z.array(z.object({ type: z.string() })),
    }),
  ),
});

// One bad entry is left out, not the whole history. The entries come back as
// they were stored, because the schema above would strip the fields it does
// not name.
function parse(raw: string | null): Conversation[] {
  try {
    const list: unknown = raw ? JSON.parse(raw) : none;
    if (!Array.isArray(list)) return none;
    return list.filter((c) => stored.safeParse(c).success) as Conversation[];
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
