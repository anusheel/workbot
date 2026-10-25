import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { type Tool, inputSchema } from "./tool";

export const providerNames = ["anthropic", "openai"] as const;
export type ProviderName = (typeof providerNames)[number];

export type Message = { role: "user" | "assistant"; content: string };
export type Usage = { input: number; output: number };
export type Effort = "low" | "medium" | "high";

/** Two sizes of model: the small one reads, extracts and judges; the large one decides and writes. */
export const sizes = ["small", "large"] as const;
export type Size = (typeof sizes)[number];

/**
 * A model id, its size for routing, and its published price in dollars per
 * million tokens where there is one. A cache read costs `cacheRead` times the
 * input price (a tenth unless said otherwise), a cache write 1.25 times it.
 */
export type Model = {
  id: string;
  size: Size;
  price?: { input: number; output: number; cacheRead?: number };
};

export type Completion = {
  model: string;
  system: string;
  messages: Message[];
  maxTokens: number;
  tools?: Tool[];
  /** Reasoning depth, on models that reason. */
  effort?: Effort;
  /** Sampling temperature, on models that still take one. */
  temperature?: number;
};

export type ToolCall = {
  name: string;
  input: unknown;
  result: string;
  failed: boolean;
};

/** What a completion reports as it runs. */
export type Events = { text(delta: string): void; tool?(call: ToolCall): void };

export type Provider = {
  name: ProviderName;
  /** The first model is the default. */
  models: Model[];
  /** Streams the reply, running tools the model calls, and resolves with the tokens used. */
  stream(completion: Completion, on: Events): Promise<Usage>;
};

// A turn may call tools several times in a row; past this many rounds the
// loop stops and whatever text the model produced stands.
const maxToolRounds = 8;

// Both SDKs retry rate limits and server errors with backoff; 3 attempts ride
// out a burst without hiding an outage. Clients are built on first use, so
// switching to a provider without a key fails at the request, where the
// error can be shown, rather than at the switch.
const retries = { maxRetries: 3 };

async function run(
  tools: Tool[],
  name: string,
  input: unknown,
  on: Events,
): Promise<ToolCall> {
  const tool = tools.find((t) => t.name === name);
  const parsed = tool?.input.safeParse(input);
  const outcome = !tool
    ? { result: `There is no tool named ${name}.`, failed: true }
    : !parsed?.success
      ? { result: z.prettifyError(parsed!.error), failed: true }
      : await tool.run(parsed.data).then(
          (result) => ({ result, failed: false }),
          (err: unknown) => ({
            result: err instanceof Error ? err.message : String(err),
            failed: true,
          }),
        );
  const call = { name, input, ...outcome };
  on.tool?.(call);
  return call;
}

export function anthropic(
  options?: ConstructorParameters<typeof Anthropic>[0],
): Provider {
  let client: Anthropic | undefined;
  return {
    name: "anthropic",
    models: [
      {
        id: "claude-sonnet-5-5",
        size: "large",
        price: { input: 2, output: 10, cacheRead: 0.05 },
      },
      {
        id: "claude-haiku-5-5",
        size: "small",
        price: { input: 0.1, output: 0.5 },
      },
      {
        id: "claude-opus-5-5",
        size: "large",
        price: { input: 4, output: 20, cacheRead: 0.05 },
      },
    ],
    async stream(
      { model, system, messages, maxTokens, tools = [], effort, temperature },
      on,
    ) {
      client ??= new Anthropic({ ...retries, ...options });
      const history: Anthropic.MessageParam[] = [...messages];
      const definitions: Anthropic.Tool[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: inputSchema(tool) as Anthropic.Tool.InputSchema,
        eager_input_streaming: true,
      }));
      const usage: Usage = { input: 0, output: 0 };
      for (let round = 0; round <= maxToolRounds; round++) {
        const stream = client.messages.stream({
          model,
          system,
          messages: history,
          max_tokens: maxTokens,
          ...(definitions.length && { tools: definitions }),
          ...(effort && { output_config: { effort } }),
          ...(temperature !== undefined && { temperature }),
        });
        stream.on("text", on.text);
        const message = await stream.finalMessage();
        usage.input += message.usage.input_tokens;
        usage.output += message.usage.output_tokens;
        // Anything but tool_use ends the turn, including a reply cut off at max_tokens
        // mid-call: a truncated tool input must never run.
        if (message.stop_reason !== "tool_use") return usage;
        const calls = message.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );
        const results = await Promise.all(
          calls.map(async (call): Promise<Anthropic.ToolResultBlockParam> => {
            const { result, failed } = await run(
              tools,
              call.name,
              call.input,
              on,
            );
            return {
              type: "tool_result",
              tool_use_id: call.id,
              content: result,
              ...(failed && { is_error: true }),
            };
          }),
        );
        history.push(
          { role: "assistant", content: message.content },
          { role: "user", content: results },
        );
      }
      return usage;
    },
  };
}

export function openai(
  options?: ConstructorParameters<typeof OpenAI>[0],
): Provider {
  let client: OpenAI | undefined;
  return {
    name: "openai",
    models: [
      { id: "gpt-5.5", size: "large" },
      { id: "gpt-5.4-mini", size: "small" },
      { id: "gpt-5.4-nano", size: "small" },
    ],
    async stream(
      { model, system, messages, maxTokens, tools = [], effort, temperature },
      on,
    ) {
      client ??= new OpenAI({ ...retries, ...options });
      const input: OpenAI.Responses.ResponseInputItem[] = [...messages];
      const definitions: OpenAI.Responses.FunctionTool[] = tools.map(
        (tool) => ({
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: inputSchema(tool),
          strict: true,
        }),
      );
      const usage: Usage = { input: 0, output: 0 };
      for (let round = 0; round <= maxToolRounds; round++) {
        const stream = await client.responses.create({
          model,
          instructions: system,
          input,
          max_output_tokens: maxTokens,
          stream: true,
          ...(definitions.length && { tools: definitions }),
          ...(effort && { reasoning: { effort } }),
          ...(temperature !== undefined && { temperature }),
        });
        let output: OpenAI.Responses.ResponseOutputItem[] = [];
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") on.text(event.delta);
          if (event.type === "response.failed") {
            throw new Error(
              event.response.error?.message ?? "The response failed.",
            );
          }
          if (
            event.type === "response.completed" ||
            event.type === "response.incomplete"
          ) {
            const { input_tokens = 0, output_tokens = 0 } =
              event.response.usage ?? {};
            usage.input += input_tokens;
            usage.output += output_tokens;
            // A response cut off at the token limit may hold a call with partial
            // arguments: its tokens count, but its output must never run.
            if (event.type === "response.completed")
              output = event.response.output;
          }
        }
        const calls = output.filter((item) => item.type === "function_call");
        if (calls.length === 0) return usage;
        // The model's own items go back as they came; reasoning items are what
        // lets a reasoning model continue after its tool calls.
        for (const item of output) {
          if (
            item.type === "message" ||
            item.type === "function_call" ||
            item.type === "reasoning"
          )
            input.push(item);
        }
        for (const call of calls) {
          let parsed: unknown;
          let result: string | undefined;
          try {
            parsed = JSON.parse(call.arguments);
          } catch (err) {
            result = `The arguments are not valid JSON: ${(err as Error).message}`;
            on.tool?.({
              name: call.name,
              input: call.arguments,
              result,
              failed: true,
            });
          }
          result ??= (await run(tools, call.name, parsed, on)).result;
          input.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: result,
          });
        }
      }
      return usage;
    },
  };
}

export const providers: Record<ProviderName, () => Provider> = {
  anthropic,
  openai,
};

/** Runs a completion to the end and returns its text, for the steps of a chain. */
export async function complete(provider: Provider, completion: Completion) {
  let text = "";
  const usage = await provider.stream(completion, {
    text: (delta) => (text += delta),
  });
  return { text, usage };
}

/** The published price of a model from either catalogue, if there is one. */
export const priceOf = (modelId: string) =>
  Object.values(providers)
    .flatMap((provider) => provider().models)
    .find((m) => m.id === modelId)?.price;

/** Tokens by kind: fresh input, output, and input served from or written to the cache. */
export type Spend = Usage & { cacheRead?: number; cacheWrite?: number };

/** What a run cost in dollars at the model's published price; 0 when it has none. */
export function costOf(modelId: string, spend: Spend): number {
  const price = priceOf(modelId);
  if (!price) return 0;
  const input =
    spend.input +
    (spend.cacheRead ?? 0) * (price.cacheRead ?? 0.1) +
    (spend.cacheWrite ?? 0) * 1.25;
  return (input * price.input + spend.output * price.output) / 1e6;
}
