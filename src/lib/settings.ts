import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { config } from "./config";
import { customer } from "./customer";
import { providerNames, sizes } from "./providers";

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
export type Route =
  `${(typeof providerNames)[number]}/${(typeof sizes)[number]}`;
export const allRoutes = providerNames.flatMap((provider) =>
  sizes.map((size): Route => `${provider}/${size}`),
);
const RouteName = z.custom<Route>(
  (value) => (allRoutes as string[]).includes(String(value)),
  { message: `a route is one of ${allRoutes.join(", ")}` },
);

/**
 * What a deployment does, as the product's defaults (content/defaults.json),
 * then the customer's overrides, then the environment's. The three levels
 * meet here and nowhere else.
 */
export const Settings = z.object({
  // The model each task runs on, then the ones that answer when it cannot, in order.
  routes: z.record(z.enum(tasks), z.array(RouteName).min(1)),
  pages: z.object({ maxAgeMinutes: z.number().positive() }),
});
export type Settings = z.infer<typeof Settings>;
export const Overrides = z
  .object({
    routes: z.partialRecord(z.enum(tasks), z.array(RouteName).min(1)),
    pages: Settings.shape.pages.partial(),
  })
  .partial();
export type Overrides = z.infer<typeof Overrides>;

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

/** The precedence, written once: a customer's value replaces the default's; an environment route goes first in its task's chain. */
export function resolve(
  defaults: Settings,
  overrides: Overrides,
  env: Partial<Record<Task, Route>>,
): Settings {
  const routes = { ...defaults.routes, ...overrides.routes };
  for (const task of tasks) {
    const first = env[task];
    if (first) routes[task] = [...new Set([first, ...routes[task]])];
  }
  return Settings.parse({
    routes,
    pages: { ...defaults.pages, ...overrides.pages },
  });
}

const defaults = Settings.parse(
  JSON.parse(
    readFileSync(path.join(process.cwd(), "content/defaults.json"), "utf8"),
  ),
);

export const settings: Settings = resolve(
  defaults,
  Overrides.parse(customer.settings ?? {}),
  overridesOf(config.routes),
);
