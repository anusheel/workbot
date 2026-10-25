import { expect, test, vi } from "vitest";
import { customer } from "./customer";
import { rules } from "./rules";
import { teams } from "./requests";
import { settings } from "./settings";
import { systemPrompt } from "./system-prompt";

vi.hoisted(() => {
  process.env.CUSTOMER = "harbor-dental";
});

// A second tenant is a second file: CUSTOMER names it, and nothing else changes.
test("a deployment serves the customer CUSTOMER names, teams, prompt and settings included", () => {
  expect(customer.name).toBe("Harbor Dental");
  expect(teams).toEqual(["front", "billing"]);
  expect(systemPrompt).toContain(
    "You are DeskBot, the assistant for Harbor Dental's front and billing teams",
  );
  expect(settings.routes.chat).toEqual(["anthropic/large", "anthropic/small"]);
  expect(settings.routes.triage).toEqual([
    "anthropic/small",
    "anthropic/large",
  ]);
  // No rules file of its own yet: the product\'s rules, and none naming a team it lacks.
  expect(rules.map((r) => r.id)).toEqual([
    "phone-e164",
    "company-from-domain",
    "large-invoice",
  ]);
});
