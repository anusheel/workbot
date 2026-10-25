import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { type ToolSet, tool } from "ai";
import { config } from "./config";
import { type ProviderName, providers } from "./providers";
import { tools } from "./tools";

/** A model as the AI SDK addresses it, from a provider name and a model id. */
export const aiModel = (provider: ProviderName, id: string) =>
  provider === "openai" ? openai(id) : anthropic(id);

/** The model behind the web chat: the configured one, else the provider's default. */
export function chatModel() {
  const { provider, model } = config.chat;
  return aiModel(provider, model ?? providers[provider]().models[0].id);
}

/** The assistant's tools in the AI SDK's shape, from the one registry. */
export const chatTools: ToolSet = Object.fromEntries(
  tools.map((t) => [
    t.name,
    tool({
      description: t.description,
      inputSchema: t.input,
      execute: (input) => t.run(input),
    }),
  ]),
);
