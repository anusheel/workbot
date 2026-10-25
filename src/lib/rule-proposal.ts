import { appendFileSync, readFileSync } from "node:fs";
import { type LanguageModel, generateText } from "ai";
import { customer } from "./customer";
import { query } from "./db";
import { teams } from "./requests";
import { grammarSource, parseRules, printRule } from "./rule-language";
import { type Applied, type Rule, Rules, applyRules, rulesFile } from "./rules";

const fields: Record<Rule["on"], string> = {
  contact: "name, email, phone, company",
  ticket:
    "title, body, text (the title again, which the routing rules read), team, state, assignee, labels",
  invoice:
    "vendor, vendorEmail, vendorPhone, number, date, due, currency, total, terms",
};

/**
 * The model writes one rule in the language for what was asked; a line that
 * does not parse, or names a team the customer lacks, goes back to it once
 * with the error. Configuration is the model's workspace: the rule is a line
 * in a file a person reads, not code.
 */
export async function proposeRule(
  ask: string,
  model: LanguageModel,
  existing = readFileSync(rulesFile, "utf8"),
): Promise<{ rule: Rule; line: string }> {
  const instructions = `You write one rule for ${customer.name}'s assistant, in the rule language below, and nothing else: no prose, no code fence, one line starting with "rule".

The grammar:
${grammarSource}

Fields by kind: contact: ${fields.contact}. ticket: ${fields.ticket}. invoice: ${fields.invoice}.
Teams a ticket may be set to: ${teams.join(", ")}.
A rule's id is a short lowercase name with hyphens. Conditions see the record as the rules before it left it; a routing rule starts with "team is missing".

The rules so far:
${existing}`;
  let prompt = ask;
  for (let attempt = 0; ; attempt++) {
    const { text } = await generateText({ model, instructions, prompt });
    const line =
      text
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("rule ")) ?? text.trim();
    try {
      const [rule] = Rules.parse(parseRules(line));
      if (!rule) throw new Error("the answer holds no rule");
      return { rule, line: printRule(rule) };
    } catch (err) {
      if (attempt) throw err;
      prompt = `${ask}\n\nYour line was:\n${line}\n\nIt was refused:\n${err instanceof Error ? err.message : String(err)}\n\nWrite the one line again.`;
    }
  }
}

export type DryRun = {
  kind: Rule["on"];
  total: number;
  changed: { label: string; applied: Applied[] }[];
};

type Row = { label: string } & Record<string, unknown>;

/** What the rule would change on the current copy: the last 100 records of its kind, each as the rules already left it. */
export async function dryRun(rule: Rule): Promise<DryRun> {
  const rows =
    rule.on === "contact"
      ? await query<Row>(
          `select name as label, name, email, phone, company from contacts order by updated_at desc limit 100`,
        )
      : rule.on === "ticket"
        ? await query<Row>(
            `select case when source = 'github' then '#' || key else title end as label,
               title, body, title as text, team, state, assignee, labels
             from tickets order by updated_at desc limit 100`,
          )
        : await query<Row>(
            `select name as label, data from documents where type = 'invoice' order by created_at desc limit 100`,
          );
  const changed = rows.flatMap(({ label, ...record }) => {
    const { applied } = applyRules(
      rule.on,
      rule.on === "invoice" ? (record.data as Record<string, unknown>) : record,
      [rule],
    );
    return applied.length ? [{ label, applied }] : [];
  });
  return { kind: rule.on, total: rows.length, changed };
}

/** Appends the rule to the file; the next start reads it with the rest. */
export function approve(rule: Rule, file = rulesFile) {
  appendFileSync(file, `${printRule(rule)}\n`);
}
