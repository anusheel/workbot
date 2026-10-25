import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const providerNames = ["anthropic", "openai"] as const;
export type ProviderName = (typeof providerNames)[number];

export type Message = { role: "user" | "assistant"; content: string };
export type Usage = { input: number; output: number };
export type Effort = "low" | "medium" | "high";

/** A model id, with its published price in dollars per million tokens where there is one. */
export type Model = { id: string; price?: { input: number; output: number } };

export type Completion = {
  model: string;
  system: string;
  messages: Message[];
  maxTokens: number;
  /** Reasoning depth, on models that reason. */
  effort?: Effort;
  /** Sampling temperature, on models that still take one. */
  temperature?: number;
};

export type Provider = {
  name: ProviderName;
  /** The first model is the default. */
  models: Model[];
  /** Streams the reply through onText and resolves with the tokens used. */
  stream(
    completion: Completion,
    onText: (text: string) => void,
  ): Promise<Usage>;
};

// Both SDKs retry rate limits and server errors with backoff; 3 attempts ride
// out a burst without hiding an outage. Clients are built on first use, so
// switching to a provider without a key fails at the request, where the
// error can be shown, rather than at the switch.
const retries = { maxRetries: 3 };

export function anthropic(
  options?: ConstructorParameters<typeof Anthropic>[0],
): Provider {
  let client: Anthropic | undefined;
  return {
    name: "anthropic",
    models: [
      { id: "claude-sonnet-5-5", price: { input: 2, output: 10 } },
      { id: "claude-haiku-5-5", price: { input: 0.1, output: 0.5 } },
      { id: "claude-opus-5-5", price: { input: 4, output: 20 } },
    ],
    async stream(
      { model, system, messages, maxTokens, effort, temperature },
      onText,
    ) {
      client ??= new Anthropic({ ...retries, ...options });
      const stream = client.messages.stream({
        model,
        system,
        messages,
        max_tokens: maxTokens,
        ...(effort && { output_config: { effort } }),
        ...(temperature !== undefined && { temperature }),
      });
      stream.on("text", onText);
      const { usage } = await stream.finalMessage();
      return { input: usage.input_tokens, output: usage.output_tokens };
    },
  };
}

export function openai(
  options?: ConstructorParameters<typeof OpenAI>[0],
): Provider {
  let client: OpenAI | undefined;
  return {
    name: "openai",
    models: [{ id: "gpt-5.5" }, { id: "gpt-5.4-mini" }, { id: "gpt-5.4-nano" }],
    async stream(
      { model, system, messages, maxTokens, effort, temperature },
      onText,
    ) {
      client ??= new OpenAI({ ...retries, ...options });
      const stream = await client.responses.create({
        model,
        instructions: system,
        input: messages,
        max_output_tokens: maxTokens,
        stream: true,
        ...(effort && { reasoning: { effort } }),
        ...(temperature !== undefined && { temperature }),
      });
      let usage: Usage = { input: 0, output: 0 };
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") onText(event.delta);
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
          usage = { input: input_tokens, output: output_tokens };
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
