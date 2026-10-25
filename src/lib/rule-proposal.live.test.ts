import { expect, test } from "vitest";
import { modelFor } from "./routing";
import { proposeRule } from "./rule-proposal";

// The model writes a rule in the language from one sentence, and the parser takes it.
test("the model proposes a routing rule that parses and names the right team", async () => {
  const { rule, line } = await proposeRule(
    "Tickets whose title mentions a forklift or a pallet jack go to operations.",
    modelFor("generate"),
  );
  expect(line).toMatch(/^rule [a-z0-9-]+ on ticket when /);
  expect(rule.then).toEqual({ set: { team: "operations" } });
  expect(JSON.stringify(rule.when)).toMatch(/forklift/i);
});
