import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  APICallError,
  type LanguageModelV4,
  type LanguageModelV4Middleware,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";
import { config } from "./config";
import { type ProviderName, type Size, providers } from "./providers";
import { type Route, type Task, settings } from "./settings";
import { traced } from "./tracing";

export {
  type Route,
  type Task,
  allRoutes,
  overridesOf,
  tasks,
} from "./settings";

/** The production routing: content/defaults.json, with the customer's and the environment's overrides applied. */
export const routes = settings.routes;

const outage: LanguageModelV4Middleware = {
  specificationVersion: "v4",
  wrapGenerate: async ({ model }) => {
    throw simulated(model);
  },
  wrapStream: async ({ model }) => {
    throw simulated(model);
  },
};
const simulated = (model: LanguageModelV4) =>
  new APICallError({
    message: `Simulated outage of ${model.modelId}`,
    url: "",
    requestBodyValues: {},
    statusCode: 503,
    isRetryable: true,
  });

/** A model as the AI SDK addresses it, every call traced; down when `OUTAGE` names it or its provider. */
export function aiModel(provider: ProviderName, id: string): LanguageModelV4 {
  const model = provider === "openai" ? openai(id) : anthropic(id);
  const down = config.outages.includes(provider) || config.outages.includes(id);
  return traced(
    down ? wrapLanguageModel({ model, middleware: outage }) : model,
  );
}

/** The model a route names: the provider's model of that size. */
export function modelOf(route: Route): LanguageModelV4 {
  const [provider, size] = route.split("/") as [ProviderName, Size];
  const { models } = providers[provider]();
  return aiModel(
    provider,
    (models.find((m) => m.size === size) ?? models[0]).id,
  );
}

/** The failures another model can take over: the provider down, rate-limited or unreachable. A bad request or a bad key fails anywhere. */
export const transient = (error: unknown) =>
  APICallError.isInstance(error) && error.isRetryable;

const fallingBackTo = (next: LanguageModelV4): LanguageModelV4Middleware => ({
  specificationVersion: "v4",
  wrapGenerate: async ({ doGenerate, params }) => {
    try {
      return await doGenerate();
    } catch (error) {
      if (!transient(error)) throw error;
      return next.doGenerate(params);
    }
  },
  wrapStream: async ({ doStream, params }) => {
    try {
      return await doStream();
    } catch (error) {
      if (!transient(error)) throw error;
      return next.doStream(params);
    }
  },
});

/**
 * Models in order: a call the first cannot take goes to the second with the
 * same parameters, and so on. A stream that fails once it has started is not
 * retried elsewhere; part of the reply is already out.
 */
export const chain = (models: LanguageModelV4[]): LanguageModelV4 =>
  models.reduceRight((next, model) =>
    wrapLanguageModel({ model, middleware: fallingBackTo(next) }),
  );

/** The model for a task: its routes in a chain, as the settings resolved them. */
export function modelFor(task: Task): LanguageModelV4 {
  return chain(routes[task].map(modelOf));
}
