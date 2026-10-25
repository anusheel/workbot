import { expect, test } from "vitest";
import { Customer, customer, teamList } from "./customer";
import { systemPromptFor } from "./system-prompt";

test("the configured customer parses, with teams that the filing rules can name", () => {
  expect(customer.teams.map((t) => t.id)).toEqual([
    "operations",
    "finance",
    "support",
  ]);
  expect(teamList(customer)).toBe("operations, finance and support");
});

test("a filing rule that names no team, or a team named twice, does not load", () => {
  const bad = { ...customer, filing: { ...customer.filing, invoice: "legal" } };
  expect(() => Customer.parse(bad)).toThrow("filing names a team");
  const twice = { ...customer, teams: [customer.teams[0], customer.teams[0]] };
  expect(() => Customer.parse(twice)).toThrow("team ids repeat");
});

test("another customer is another file: the prompt names it and its teams", () => {
  const other = Customer.parse({
    name: "Harbor Dental",
    assistant: "DeskBot",
    about: "a dental practice with 3 clinics",
    teams: [
      { id: "front", files: "patients and appointments" },
      { id: "billing", files: "money" },
    ],
    filing: { invoice: "billing", complaint: "front", other: "front" },
    customerSections: ["faq"],
  });
  const prompt = systemPromptFor(other);
  expect(prompt).toContain(
    "You are DeskBot, the assistant for Harbor Dental's front and billing teams",
  );
  expect(prompt).toContain("unrelated to work at Harbor Dental");
  expect(prompt).not.toContain("Fieldstone");
});
