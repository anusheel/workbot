import { type LanguageModel, Output, generateText } from "ai";
import { z } from "zod";
import { query } from "./db";

export const kinds = ["preference", "entity", "case"] as const;
export type Kind = (typeof kinds)[number];
export type Memory = { id: string; kind: Kind; text: string; createdAt: Date };

const Extracted = z.object({
  memories: z
    .array(
      z.object({
        kind: z.enum(kinds),
        text: z.string().trim().min(3).max(200),
      }),
    )
    .max(3)
    .describe(
      "durable facts about the person; empty when the exchange taught nothing lasting",
    ),
});

/** How many memories one prompt carries, so it does not grow with every reply. */
const promptLimit = 30;

const columns = `id, kind, text, created_at as "createdAt"`;

/** Newest first; without a limit it returns everything, for the settings page. */
export async function listMemories(
  visitor: string,
  limit?: number,
): Promise<Memory[]> {
  return query<Memory>(
    `select ${columns} from memories where visitor = $1 order by created_at desc limit $2`,
    [visitor, limit ?? null],
  );
}

/** Keeps a fact about a visitor; the same words twice are one memory. */
export async function remember(
  visitor: string,
  kind: Kind,
  text: string,
): Promise<void> {
  await query(
    `insert into memories (visitor, kind, text) values ($1, $2, $3) on conflict do nothing`,
    [visitor, kind, text],
  );
}

export async function forget(visitor: string, id: string): Promise<void> {
  await query(`delete from memories where visitor = $1 and id = $2`, [
    visitor,
    id,
  ]);
}

export async function forgetAll(visitor: string): Promise<void> {
  await query(`delete from memories where visitor = $1`, [visitor]);
}

/** What the assistant should know about the person, for the system prompt; empty when there is nothing. */
export function memoryNote(memories: Memory[]): string {
  if (memories.length === 0) return "";
  const lines = memories
    .slice(0, promptLimit)
    .map((m) => `- ${m.text} (${m.kind})`)
    .join("\n");
  return `What you know about this person from earlier conversations. Use it; do not repeat it back unless asked.\n${lines}`;
}

/**
 * Pulls lasting facts out of one exchange with a small model: how the person
 * likes to be answered, who and what they work with, and the cases they are on.
 */
export async function extractMemories(
  model: LanguageModel,
  exchange: { user: string; assistant: string },
  known: Memory[],
) {
  known = known.slice(0, promptLimit);
  const { output } = await generateText({
    model,
    output: Output.object({ schema: Extracted }),
    instructions: `You maintain an assistant's memory of a person. From the exchange, extract up to 3 new facts worth keeping for future conversations: preferences (how they want answers), entities (their team, role, systems, vendors or people they deal with) and cases (requests or tickets they are working on). Only facts the person stated or clearly implied about themselves; nothing about the assistant's answer, nothing already known. Each fact is one plain sentence about "the person".${known.length ? `\n\nAlready known:\n${known.map((m) => `- ${m.text}`).join("\n")}` : ""}`,
    prompt: `Person: ${exchange.user}\n\nAssistant: ${exchange.assistant}`,
  });
  return output.memories;
}
