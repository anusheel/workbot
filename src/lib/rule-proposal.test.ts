import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { parseRules } from "./rule-language";
import { approve, dryRun, proposeRule } from "./rule-proposal";
import { rulesFile } from "./rules";
import { fromIssue, upsertTicket } from "./unified";

/** A model that answers the given lines in turn, and remembers what it was asked. */
function scripted(lines: string[]) {
  const prompts: string[] = [];
  let turn = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      return {
        content: [{ type: "text", text: lines[turn++] }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

const forklifts =
  'rule route-forklifts on ticket when team is missing and text matches "forklift|pallet jack" then set team = "operations"';

test("a line that does not parse goes back to the model once, with the error, and the second one is taken", async () => {
  const { model, prompts } = scripted([
    "rule route-forklifts on ticket when team is missing then team = operations",
    `Here it is:\n${forklifts}`,
  ]);
  const { rule, line } = await proposeRule(
    "route forklift tickets to operations",
    model,
  );
  expect(line).toBe(forklifts);
  expect(rule.then).toEqual({ set: { team: "operations" } });
  expect(prompts).toHaveLength(2);
  expect(prompts[1]).toMatch(/It was refused/);
});

test("a rule naming a team the customer lacks is refused twice and the proposal fails", async () => {
  const { model } = scripted([
    'rule a on ticket when team is missing then set team = "legal"',
    'rule a on ticket when team is missing then set team = "legal"',
  ]);
  await expect(proposeRule("route to legal", model)).rejects.toThrow(
    /team the customer has/,
  );
});

test("the dry run says what the rule would change on the current copy, and nothing else", async () => {
  await upsertTicket(
    fromIssue("acme/helpdesk", {
      number: 7,
      title: "Forklift charger dead",
      state: "OPEN",
      updated_at: "2026-10-20T08:00:00Z",
    }),
  );
  await upsertTicket(
    fromIssue("acme/helpdesk", {
      number: 8,
      title: "Invoice 4471 unpaid",
      state: "OPEN",
      updated_at: "2026-10-20T09:00:00Z",
    }),
  );
  const run = await dryRun(parseRules(forklifts)[0]);
  expect(run).toEqual({
    kind: "ticket",
    total: 2,
    changed: [
      {
        label: "#7",
        applied: [
          {
            rule: "route-forklifts",
            field: "team",
            from: null,
            to: "operations",
          },
        ],
      },
    ],
  });
});

test("an approved rule is one more line in the file, and parses with the rest", () => {
  const file = join(mkdtempSync(join(tmpdir(), "rules-")), "rules.rules");
  writeFileSync(file, readFileSync(rulesFile, "utf8"));
  approve(parseRules(forklifts)[0], file);
  const rules = parseRules(readFileSync(file, "utf8"));
  expect(rules).toHaveLength(7);
  expect(rules.at(-1)?.id).toBe("route-forklifts");
});
