import * as ohm from "ohm-js";
import type { Rule } from "./rules";

/**
 * The rule language: one line per rule, read by people and written by the
 * model, parsed into the same objects the engine applies. Its BNF is in
 * docs/config.md; this is the Ohm grammar, which is the BNF with the lexical
 * rules spelled out.
 */
export const grammarSource = String.raw`
Rules {
  Rules = Rule*
  Rule = rule ident on kind when Conditions then Action
  Conditions = NonemptyListOf<Condition, and>
  Condition = ident matches string   -- matches
            | ident is missing       -- missing
            | ident over number      -- over
  Action = set NonemptyListOf<Assignment, ",">  -- set
         | normalize "phone"                     -- phone
         | "company" from "email"                -- company
         | flag string                           -- flag
  Assignment = ident "=" string

  kind (a kind of record) = ("contact" | "ticket" | "invoice") ~identRest
  keyword = (rule | on | when | and | then | set | normalize | from | flag | matches | is | missing | over)
  rule = "rule" ~identRest
  on = "on" ~identRest
  when = "when" ~identRest
  and = "and" ~identRest
  then = "then" ~identRest
  set = "set" ~identRest
  normalize = "normalize" ~identRest
  from = "from" ~identRest
  flag = "flag" ~identRest
  matches = "matches" ~identRest
  is = "is" ~identRest
  missing = "missing" ~identRest
  over = "over" ~identRest
  identRest = alnum | "-" | "_"
  ident (a name) = ~keyword letter identRest*
  string (a quoted string) = "\"" stringChar* "\""
  stringChar = "\\" any         -- escape
             | ~"\"" ~"\n" any  -- plain
  number (a number) = digit+ ("." digit+)?
  comment = "#" (~"\n" any)*
  space += comment
}
`;

const grammar = ohm.grammar(grammarSource);
const semantics = grammar.createSemantics();

type Node = ohm.Node;
const text = (node: Node) => node.sourceString;
const each = (list: Node) => list.asIteration().children.map((c) => c.toAST());

semantics.addOperation<unknown>("toAST", {
  Rules: (rules) => rules.children.map((r) => r.toAST()),
  Rule: (_rule, id, _on, kind, _when, conditions, _then, action) => ({
    id: text(id),
    on: text(kind),
    when: conditions.toAST(),
    then: action.toAST(),
  }),
  Conditions: (list) => each(list),
  Condition_matches: (field, _matches, pattern) => ({
    field: text(field),
    matches: pattern.toAST(),
  }),
  Condition_missing: (field, _is, _missing) => ({
    field: text(field),
    missing: true,
  }),
  Condition_over: (field, _over, number) => ({
    field: text(field),
    over: Number(text(number)),
  }),
  Action_set: (_set, list) => ({ set: Object.fromEntries(each(list)) }),
  Action_phone: (_normalize, _phone) => ({ normalize: "phone" }),
  Action_company: (_company, _from, _email) => ({ companyFromEmail: true }),
  Action_flag: (_flag, message) => ({ flag: message.toAST() }),
  Assignment: (field, _eq, value) => [text(field), value.toAST()],
  string: (_open, chars, _close) =>
    chars.children.map((c) => c.toAST()).join(""),
  // A quote or a backslash escaped is itself; any other escape stays as written, so "\d" is the pattern \d.
  stringChar_escape: (_backslash, char) =>
    ['"', "\\"].includes(text(char)) ? text(char) : `\\${text(char)}`,
  stringChar_plain: (char) => text(char),
});

/** The rules in a text, as the engine applies them; a text that does not parse throws with the line and column. */
export function parseRules(source: string): Rule[] {
  const match = grammar.match(source);
  if (match.failed()) throw new Error(match.message);
  return semantics(match).toAST() as Rule[];
}

const quote = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const condition = (c: Rule["when"][number]) =>
  "missing" in c
    ? `${c.field} is missing`
    : "over" in c
      ? `${c.field} over ${c.over}`
      : `${c.field} matches ${quote(c.matches)}`;

const action = (a: Rule["then"]) =>
  "set" in a
    ? `set ${Object.entries(a.set)
        .map(([field, value]) => `${field} = ${quote(value)}`)
        .join(", ")}`
    : "normalize" in a
      ? "normalize phone"
      : "companyFromEmail" in a
        ? "company from email"
        : `flag ${quote(a.flag)}`;

/** The rules as the language writes them, one a line, which parses back to the same rules. */
export const printRule = (rule: Rule) =>
  `rule ${rule.id} on ${rule.on} when ${rule.when.map(condition).join(" and ")} then ${action(rule.then)}`;

export const printRules = (rules: Rule[]) => rules.map(printRule).join("\n");
