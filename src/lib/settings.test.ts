import { expect, test } from "vitest";
import {
  Overrides,
  Settings,
  overridesOf,
  resolve,
  settings,
} from "./settings";

const defaults: Settings = {
  routes: {
    chat: ["anthropic/small", "anthropic/large"],
    generate: ["anthropic/large", "anthropic/small"],
    research: ["anthropic/small", "anthropic/large"],
    summarize: ["anthropic/small", "anthropic/large"],
    extract: ["anthropic/small", "anthropic/large"],
    triage: ["anthropic/small", "anthropic/large"],
    read: ["anthropic/small", "anthropic/large"],
    analyze: ["anthropic/small", "anthropic/large"],
    judge: ["anthropic/large"],
  },
  pages: { maxAgeMinutes: 60 },
  retention: {
    tracesDays: 90,
    measurementsDays: 30,
    documentBytesDays: 30,
    sheetsDays: 30,
    conversationsDays: 90,
  },
};

test("the defaults file parses and the running settings come from it", () => {
  expect(settings.routes.judge).toEqual(["anthropic/large"]);
  expect(settings.pages.maxAgeMinutes).toBe(60);
});

test("a customer's value replaces the default's, task by task and field by field", () => {
  const resolved = resolve(
    defaults,
    {
      routes: { chat: ["anthropic/large"] },
      pages: { maxAgeMinutes: 5 },
      // A contract that keeps traces for a week, and the rest as the product does.
      retention: { tracesDays: 7 },
    },
    {},
  );
  expect(resolved.routes.chat).toEqual(["anthropic/large"]);
  expect(resolved.routes.generate).toEqual(defaults.routes.generate);
  expect(resolved.pages.maxAgeMinutes).toBe(5);
  expect(resolved.retention).toEqual({
    tracesDays: 7,
    measurementsDays: 30,
    documentBytesDays: 30,
    sheetsDays: 30,
    conversationsDays: 90,
  });
});

test("an environment route goes first in its task's chain, once", () => {
  const resolved = resolve(defaults, {}, { chat: "anthropic/large" });
  expect(resolved.routes.chat).toEqual(["anthropic/large", "anthropic/small"]);
  expect(resolved.routes.read).toEqual(defaults.routes.read);
});

test("a route or a task that does not exist stops the start", () => {
  expect(() => overridesOf({ chat: "anthropic/huge" })).toThrow(
    /not a task and a route/,
  );
  expect(() => overridesOf({ chats: "anthropic/small" })).toThrow(
    /not a task and a route/,
  );
  expect(() =>
    Overrides.parse({ routes: { chat: ["openai/medium"] } }),
  ).toThrow();
});
