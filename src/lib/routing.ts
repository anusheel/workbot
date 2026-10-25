import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  APICallError,
  type LanguageModelV4,
  type LanguageModelV4Middleware,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";
import { config } from "./config";
import {
  type ProviderName,
  type Size,
  providerNames,
  providers,
  sizes,
} from "./providers";
import { traced } from "./tracing";

/** What the app asks a model to do. Each task is routed on its own. */
export const tasks = [
  "chat",
  "generate",
  "research",
  "summarize",
  "extract",
  "triage",
  "read",
  "judge",
] as const;
export type Task = (typeof tasks)[number];

/** A model named by provider and size, so the ids stay in providers.ts. */
export type Route = `${ProviderName}/${Size}`;
export const allRoutes = providerNames.flatMap((provider) =>
  sizes.map((size): Route => `${provider}/${size}`),
);

/**
 * The production routing, from the table in docs/routing.md: the model each
 * task runs on, then the ones that answer when it cannot, in order. The judge
 * has no fallback: a score from another model is not the same score.
 */
export const routes: Record<Task, Route[]> = {
  chat: ["anthropic/small", "anthropic/large"],
  generate: ["anthropic/large", "anthropic/small"],
  research: ["anthropic/large", "anthropic/small"],
  summarize: ["anthropic/small", "anthropic/large"],
  extract: ["anthropic/small", "anthropic/large"],
  triage: ["anthropic/small", "anthropic/large"],
  read: ["anthropic/small", "anthropic/large"],
  judge: ["anthropic/small"],
};

const isTask = (value: string): value is Task =>
  (tasks as readonly string[]).includes(value);
const isRoute = (value: string | undefined): value is Route =>
  (allRoutes as string[]).includes(value ?? "");

/** The `ROUTES` pairs, checked: one naming no task or no route is a misconfiguration, and the app does not start on it. */
export function overridesOf(
  pairs: Record<string, string | undefined>,
): Partial<Record<Task, Route>> {
  for (const [task, route] of Object.entries(pairs))
    if (!isTask(task) || !isRoute(route))
      throw new Error(
        `ROUTES: "${task}=${route}" is not a task and a route. Tasks: ${tasks.join(", ")}. Routes: ${allRoutes.join(", ")}.`,
      );
  return pairs as Partial<Record<Task, Route>>;
}
const overrides = overridesOf(config.routes);

// Fails before the network, as a provider's 503 would, so the chain moves on
// and the trace shows the failure.
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

/** The model for a task: its route in a chain, the first model replaced by the `ROUTES` override when there is one. */
export function modelFor(task: Task): LanguageModelV4 {
  const [first, ...rest] = routes[task];
  return chain([...new Set([overrides[task] ?? first, ...rest])].map(modelOf));
}
