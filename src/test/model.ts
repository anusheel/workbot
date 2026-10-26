import { MockLanguageModelV4 } from "ai/test";

export type Reply = {
  text?: string;
  calls?: { name: string; input: unknown }[];
};

/** A model that answers from a script and keeps every prompt it was sent, and the names of the tools each call offered. */
export function scripted(replies: Reply[]) {
  const prompts: { role: string }[][] = [];
  const tools: string[][] = [];
  const model = new MockLanguageModelV4({
    modelId: "claude-haiku-5-5",
    doGenerate: async ({ prompt, tools: offered = [] }) => {
      prompts.push(prompt);
      tools.push(offered.map((tool) => tool.name));
      const reply = replies.shift() ?? {};
      return {
        content: [
          ...(reply.text ? [{ type: "text" as const, text: reply.text }] : []),
          ...(reply.calls ?? []).map((call, i) => ({
            type: "tool-call" as const,
            toolCallId: `call-${prompts.length}-${i}`,
            toolName: call.name,
            input: JSON.stringify(call.input),
          })),
        ],
        finishReason: {
          unified: reply.calls?.length
            ? ("tool-calls" as const)
            : ("stop" as const),
          raw: undefined,
        },
        usage: {
          inputTokens: {
            total: 100,
            noCache: 100,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 50, text: 50, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompts, tools };
}
