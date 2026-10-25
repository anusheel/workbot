import {
  type LanguageModel,
  type UIMessage,
  generateText,
  getToolName,
  isToolUIPart,
} from "ai";

/** Roughly 4 characters per token across providers; close enough to budget by. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

/** A message as a transcript line: its text, and what its tools returned, each result cut short. */
const transcriptOf = (message: UIMessage) =>
  message.parts
    .map((part) =>
      part.type === "text"
        ? part.text
        : isToolUIPart(part)
          ? `[${getToolName(part)}: ${String(part.state === "output-available" ? part.output : "").slice(0, 500)}]`
          : "",
    )
    .filter(Boolean)
    .join("\n");

/** A message's cost in the prompt: every part counts, tool inputs and results included. */
export const sizeOf = (message: UIMessage) =>
  estimateTokens(JSON.stringify(message.parts));

/**
 * Keeps the first user message (the original intent) and as many of the most
 * recent messages as fit the budget; what falls between is handed back to be
 * summarized, so nothing is silently forgotten.
 */
export function fitContext(
  messages: UIMessage[],
  budget: number,
): { kept: UIMessage[]; dropped: UIMessage[] } {
  if (messages.reduce((sum, m) => sum + sizeOf(m), 0) <= budget)
    return { kept: messages, dropped: [] };

  const [first, ...rest] = messages;
  let remaining = budget - sizeOf(first);
  let start = rest.length;
  while (start > 0 && remaining - sizeOf(rest[start - 1]) >= 0) {
    remaining -= sizeOf(rest[start - 1]);
    start -= 1;
  }
  return { kept: [first, ...rest.slice(start)], dropped: rest.slice(0, start) };
}

/**
 * A short account of messages that no longer fit, for the system prompt. The
 * transcript is itself bounded, so a very long history cannot overflow the
 * summarizer; the oldest part is cut and said to be.
 */
export async function summarize(
  model: LanguageModel,
  messages: UIMessage[],
  limit = 24_000,
): Promise<string> {
  let transcript = messages
    .map(
      (m) => `${m.role === "user" ? "Person" : "WorkBot"}: ${transcriptOf(m)}`,
    )
    .join("\n\n");
  if (estimateTokens(transcript) > limit)
    transcript = `[earlier messages omitted]\n\n${transcript.slice(-limit * 4)}`;
  const { text } = await generateText({
    model,
    instructions:
      "Summarize this part of a conversation between an employee and WorkBot in under 150 words: the facts established, decisions made and questions still open. Third person, plain sentences, numerals for numbers.",
    prompt: transcript,
  });
  return text;
}

/** The messages to send, and a summary of the ones that had to go, when the conversation outgrows the budget. */
export async function compact(
  messages: UIMessage[],
  model: LanguageModel,
  budget = 24_000,
) {
  const { kept, dropped } = fitContext(messages, budget);
  return {
    messages: kept,
    summary: dropped.length ? await summarize(model, dropped) : undefined,
  };
}
