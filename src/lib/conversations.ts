import type { UIMessage } from "ai";

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
  localStorage.setItem(key, JSON.stringify(conversations));
  for (const listener of listeners) listener();
}

function parse(raw: string | null): Conversation[] {
  try {
    return raw ? JSON.parse(raw) : none;
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
