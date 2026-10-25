import {
  type Completion,
  type Events,
  type Message,
  type Model,
  type Provider,
  type ProviderName,
  type Usage,
  providers,
} from "./providers";
import { systemPrompt } from "./system-prompt";
import { recordTrace, withTrace } from "./tracing";

export type Options = Pick<
  Completion,
  "effort" | "temperature" | "maxTokens" | "tools"
>;

type Turn = { modelId: string; usage: Usage; price?: Model["price"] };

/** One conversation: its history, the model answering it, and what it has cost so far. */
export class Session {
  provider: Provider;
  model: Model;
  system = systemPrompt;
  readonly messages: Message[] = [];
  readonly turns: Turn[] = [];

  constructor(
    name: ProviderName,
    modelId?: string,
    public options: Options = { maxTokens: 2048 },
  ) {
    [this.provider, this.model] = resolve(name, modelId);
  }

  /** Switches provider and model; the conversation carries on. */
  use(name: ProviderName, modelId?: string) {
    [this.provider, this.model] = resolve(name, modelId);
  }

  /** Sends one user message; the reply streams through the events and is kept in the history. */
  async send(text: string, on: Events): Promise<Usage> {
    this.messages.push({ role: "user", content: text });
    let reply = "";
    try {
      // The turn runs in the terminal's context, so what its tools read and cache is the terminal's.
      const usage = await withTrace(
        { caller: "terminal", name: "chat", role: "admin" },
        () =>
          this.provider.stream(
            {
              ...this.options,
              model: this.model.id,
              system: this.system,
              messages: this.messages,
            },
            {
              ...on,
              text: (delta) => {
                reply += delta;
                on.text(delta);
              },
            },
          ),
      );
      this.messages.push({ role: "assistant", content: reply });
      this.record(this.model.id, usage, this.model.price);
      return usage;
    } catch (err) {
      this.messages.pop();
      throw err;
    }
  }

  /** Adds a model call made on the session's behalf, so /cost counts it, and to the traces. */
  record(modelId: string, usage: Usage, price?: Model["price"]) {
    this.turns.push({ modelId, usage, price });
    void recordTrace({
      caller: "terminal",
      name: "chat",
      model: modelId,
      ...usage,
      cached: 0,
      dollars: price
        ? (usage.input * price.input + usage.output * price.output) / 1e6
        : 0,
      ms: 0,
      ok: true,
      error: null,
    }).catch((err: unknown) => console.error("[tracing]", err));
  }

  /** Tokens and dollars so far; models without a published price are named instead of guessed. */
  cost() {
    const total = { input: 0, output: 0, dollars: 0 };
    const unpriced = new Set<string>();
    for (const { modelId, usage, price } of this.turns) {
      total.input += usage.input;
      total.output += usage.output;
      if (price)
        total.dollars +=
          (usage.input * price.input + usage.output * price.output) / 1e6;
      else unpriced.add(modelId);
    }
    return { ...total, unpriced: [...unpriced] };
  }
}

function resolve(name: ProviderName, modelId?: string): [Provider, Model] {
  const provider = providers[name]();
  const model = modelId
    ? (provider.models.find((m) => m.id === modelId) ?? {
        id: modelId,
        size: "large" as const,
      })
    : provider.models[0];
  return [provider, model];
}
