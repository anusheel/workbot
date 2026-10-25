import {
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  generateText,
  tool as aiTool,
} from "ai";
import { type Usage, priceOf } from "./providers";
import type { Tool } from "./tools";

type ToolResultPart = Extract<
  ModelMessage,
  { role: "tool" }
>["content"][number];

export type AgentEvents = {
  /** The model's words between tool calls: what it is about to do and why. */
  thought?(text: string): void;
  tool?(call: {
    name: string;
    input: unknown;
    result: string;
    failed: boolean;
  }): void;
};

export type Limits = { steps?: number; dollars?: number; seconds?: number };
export type Stopped = "answered" | "steps" | "dollars" | "time";
export type AgentRun = {
  answer: string;
  steps: number;
  usage: Usage;
  dollars: number;
  stopped: Stopped;
};

type Options = {
  model: LanguageModel;
  system: string;
  task: string;
  tools: Tool[];
  /** The tool whose result is the answer; without one, the answer is the model's final text. */
  done?: string;
  limits?: Limits;
  on?: AgentEvents;
};

/** A tool call raced against the run's deadline, so a slow tool cannot outlive the time limit. */
function within<T>(deadline: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("The tool ran out of time.")),
      Math.max(0, deadline - Date.now()),
    );
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * The agent loop: ask the model, run the tools it calls, hand back the
 * results, ask again. It ends when the model answers in text or calls the
 * terminal tool, or when a limit stops it with what it has.
 */
export async function runAgent({
  model,
  system,
  task,
  tools,
  done,
  limits = {},
  on = {},
}: Options): Promise<AgentRun> {
  const { steps = 15, dollars = 0.5, seconds = 120 } = limits;
  const deadline = Date.now() + seconds * 1000;
  const modelId = typeof model === "string" ? model : model.modelId;
  const price = priceOf(modelId);
  const usage: Usage = { input: 0, output: 0 };
  const spent = () =>
    price ? (usage.input * price.input + usage.output * price.output) / 1e6 : 0;
  const finish = (
    stopped: Stopped,
    answer: string,
    step: number,
  ): AgentRun => ({ answer, steps: step, usage, dollars: spent(), stopped });

  const messages: ModelMessage[] = [{ role: "user", content: task }];
  const definitions: ToolSet = Object.fromEntries(
    tools.map((t) => [
      t.name,
      aiTool({ description: t.description, inputSchema: t.input }),
    ]),
  );
  let answer = "";

  for (let step = 1; step <= steps; step++) {
    if (Date.now() >= deadline) return finish("time", answer, step - 1);
    const result = await generateText({
      model,
      instructions: system,
      messages,
      tools: definitions,
      abortSignal: AbortSignal.timeout(deadline - Date.now()),
    }).catch((err: unknown) => {
      if (
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError")
      )
        return undefined;
      throw err;
    });
    if (!result) return finish("time", answer, step - 1);
    usage.input += result.usage.inputTokens ?? 0;
    usage.output += result.usage.outputTokens ?? 0;
    if (result.text) on.thought?.(result.text);
    if (result.toolCalls.length === 0)
      return finish("answered", result.text, step);

    messages.push(...result.responseMessages);
    const results: ToolResultPart[] = [];
    for (const call of result.toolCalls) {
      const tool = tools.find((t) => t.name === call.toolName);
      const { result: value, failed } =
        !tool || call.invalid
          ? {
              result: `Invalid call to ${call.toolName}${call.invalid ? `: ${call.error}` : ""}`,
              failed: true,
            }
          : await within(deadline, tool.run(call.input)).then(
              (result) => ({ result, failed: false }),
              (err: unknown) => ({
                result: err instanceof Error ? err.message : String(err),
                failed: true,
              }),
            );
      on.tool?.({
        name: call.toolName,
        input: call.input,
        result: value,
        failed,
      });
      results.push({
        type: "tool-result",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: failed
          ? { type: "error-text", value }
          : { type: "text", value },
      });
      if (call.toolName === done && !failed) answer = value;
    }
    messages.push({ role: "tool", content: results });
    if (answer) return finish("answered", answer, step);
    if (spent() >= dollars) return finish("dollars", answer, step);
  }
  return finish("steps", answer, steps);
}
