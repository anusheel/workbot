import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseRules, printRule, printRules } from "./rule-language";
import { type Rule, rules, rulesFile } from "./rules";

const one = (source: string) => parseRules(source)[0];

test("a rule names itself, its kind, its conditions and its action", () => {
  expect(
    one('rule a on ticket when team is missing then set team = "finance"'),
  ).toEqual({
    id: "a",
    on: "ticket",
    when: [{ field: "team", missing: true }],
    then: { set: { team: "finance" } },
  });
});

test("a matches condition carries its pattern, backslashes as written", () => {
  expect(
    one('rule a on contact when phone matches "\\d" then normalize phone').when,
  ).toEqual([{ field: "phone", matches: "\\d" }]);
});

test("an over condition carries a number, decimals included", () => {
  expect(
    one('rule a on invoice when total over 5000.50 then flag "big"').when,
  ).toEqual([{ field: "total", over: 5000.5 }]);
});

test("conditions join with and, in order", () => {
  expect(
    one(
      'rule a on ticket when team is missing and text matches "van" and body matches "x" then set team = "operations"',
    ).when,
  ).toEqual([
    { field: "team", missing: true },
    { field: "text", matches: "van" },
    { field: "body", matches: "x" },
  ]);
});

test("set takes several assignments", () => {
  expect(
    one(
      'rule a on ticket when team is missing then set team = "finance", state = "open"',
    ).then,
  ).toEqual({
    set: { team: "finance", state: "open" },
  });
});

test("normalize phone, company from email and flag are the other actions", () => {
  expect(
    one('rule a on contact when phone matches "1" then normalize phone').then,
  ).toEqual({ normalize: "phone" });
  expect(
    one("rule a on contact when company is missing then company from email")
      .then,
  ).toEqual({
    companyFromEmail: true,
  });
  expect(
    one('rule a on invoice when total over 1 then flag "Over the line"').then,
  ).toEqual({ flag: "Over the line" });
});

test("a quote or a backslash escaped in a string is itself", () => {
  expect(
    one('rule a on invoice when total over 1 then flag "say \\"hi\\" \\\\ now"')
      .then,
  ).toEqual({
    flag: 'say "hi" \\ now',
  });
});

test("ids may carry hyphens, digits and underscores", () => {
  expect(
    one(
      'rule route-finance_2 on ticket when team is missing then set team = "finance"',
    ).id,
  ).toBe("route-finance_2");
});

test("comments and blank lines are skipped, and rules keep their order", () => {
  const parsed = parseRules(`
    # first
    rule a on ticket when team is missing then set team = "finance"

    rule b on ticket when team is missing then set team = "support" # trailing
  `);
  expect(parsed.map((r) => r.id)).toEqual(["a", "b"]);
});

test("an empty text is no rules", () => {
  expect(parseRules("")).toEqual([]);
  expect(parseRules("# nothing yet\n")).toEqual([]);
});

test("a missing then is an error naming the line and column", () => {
  expect(() =>
    parseRules(
      'rule a on ticket when team is missing\nrule b on ticket when x is missing set team = "finance"',
    ),
  ).toThrow(/Line 2, col \d+/);
});

test("a kind the engine does not know is an error", () => {
  expect(() =>
    parseRules('rule a on deal when x is missing then flag "x"'),
  ).toThrow(/kind of record/);
});

test("a keyword cannot be a name", () => {
  expect(() =>
    parseRules('rule when on ticket when team is missing then flag "x"'),
  ).toThrow();
  expect(() =>
    parseRules('rule a on ticket when then is missing then flag "x"'),
  ).toThrow();
});

test("an unterminated string is an error", () => {
  expect(() =>
    parseRules('rule a on invoice when total over 1 then flag "open'),
  ).toThrow(/quoted string|expected/i);
});

test("a condition needs a field and an operator", () => {
  expect(() =>
    parseRules('rule a on ticket when team then flag "x"'),
  ).toThrow();
  expect(() =>
    parseRules('rule a on ticket when team over then flag "x"'),
  ).toThrow(/number/);
});

test("a rule prints as the language writes it", () => {
  const rule: Rule = {
    id: "route-finance",
    on: "ticket",
    when: [
      { field: "team", missing: true },
      { field: "text", matches: "invoice|credit" },
    ],
    then: { set: { team: "finance" } },
  };
  expect(printRule(rule)).toBe(
    'rule route-finance on ticket when team is missing and text matches "invoice|credit" then set team = "finance"',
  );
});

test("printing escapes what parsing unescapes", () => {
  const rule: Rule = {
    id: "a",
    on: "invoice",
    when: [{ field: "total", over: 1 }],
    then: { flag: 'say "hi" \\d' },
  };
  expect(printRule(rule)).toBe(
    'rule a on invoice when total over 1 then flag "say \\"hi\\" \\\\d"',
  );
  expect(parseRules(printRule(rule))).toEqual([rule]);
});

test("the Day 28 table, printed and parsed again, is the same table", () => {
  expect(parseRules(printRules(rules))).toEqual(rules);
});

test("the rules file holds the 6 rules of Day 28, in order", () => {
  expect(parseRules(readFileSync(rulesFile, "utf8")).map((r) => r.id)).toEqual([
    "phone-e164",
    "company-from-domain",
    "route-finance",
    "route-support",
    "route-operations",
    "large-invoice",
  ]);
});

test("the loaded rules are what the file says, with the routing words intact", () => {
  const finance = rules.find((r) => r.id === "route-finance")!;
  expect(finance.when).toEqual([
    { field: "team", missing: true },
    { field: "text", matches: "invoice|payment|refund|credit|statement" },
  ]);
  expect(rules.find((r) => r.id === "phone-e164")!.when).toEqual([
    { field: "phone", matches: "\\d" },
  ]);
});
