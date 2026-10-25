import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { type ToolSet, tool } from "ai";
import { config } from "./config";
import { type ProviderName, providers } from "./providers";
import { tools } from "./tools";

/** A model as the AI SDK addresses it, from a provider name and a model id. */
export const aiModel = (provider: ProviderName, id: string) =>
  provider === "openai" ? openai(id) : anthropic(id);

/** The model behind the web chat: the configured one, else the provider's default, or its small model. */
export function chatModel(size: "large" | "small" = "large") {
  const { provider, model } = config.chat;
  const { models } = providers[provider]();
  const id =
    size === "large" && model
      ? model
      : (models.find((m) => m.size === size) ?? models[0]).id;
  return aiModel(provider, id);
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
