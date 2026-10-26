import {
  type SystemModelMessage,
  type UIMessage,
  convertToModelMessages,
} from "ai";
import { compact, textOf } from "./context";
import {
  type Memory,
  extractMemories,
  listMemories,
  memoryNote,
  remember,
} from "./memory";
import { modelFor } from "./routing";
import { customerNote } from "./system-prompt";

/**
 * A turn as the assistant takes it on every channel: the prompt everyone
 * gets, first, so the provider can serve it from its cache; what is known
 * about the person, and that they are a customer when they write from
 * outside; how the channel wants the reply written; and the
 * conversation, compacted to a budget. The web streams the turn, the other
 * channels wait for it.
 */
export async function prepare({
  history,
  person,
  prompt,
  customer = false,
  style,
}: {
  history: UIMessage[];
  person?: string;
  prompt: string;
  /** The person writes from outside the company: a customer, not an employee. */
  customer?: boolean;
  style?: string;
}) {
  const [memories, { messages, summary }] = await Promise.all([
    person ? listMemories(person) : [],
    // A summary the model could not write is left out; the answer still goes, and the trace holds why.
    compact(history, modelFor("summarize")).catch(() => compact(history)),
  ]);
  // Empty on a first message, and an empty block is rejected.
  const known = [
    memoryNote(memories),
    summary && `Earlier in this conversation: ${summary}`,
    customer && customerNote,
    style,
  ]
    .filter(Boolean)
    .join("\n\n");
  const instructions: SystemModelMessage[] = [
    {
      role: "system",
      content: prompt,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    ...(known ? [{ role: "system" as const, content: known }] : []),
  ];
  return {
    instructions,
    messages: await convertToModelMessages(messages),
    memories,
    question: textOf(messages.at(-1)!),
  };
}

/** What an exchange taught about the person, kept for their next one. */
export async function learn(
  person: string,
  exchange: { user: string; assistant: string },
  memories: Memory[],
) {
  const found = await extractMemories(modelFor("extract"), exchange, memories);
  for (const { kind, text } of found) await remember(person, kind, text);
}
