# Config-first: the levels, the rule language, the generator, the task graph

Behavior is configuration and code is an interpreter. This document is the split as WorkBot makes it, the three levels a value can come from and the one place they meet, the small language the rules are written in and its grammar, the generator that turns an entity's description into the files it needs, and the task graph the repository builds with. What is not built says so.

## The split

| Layer         | Holds                                                                                                                 | Lives in                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| schemas       | what exists: the shape of a request, a document, a ticket, a contact, an entity                                       | `src/lib/*-model.ts`, `src/lib/entity-model.ts`, the Zod in each module                                                   |
| configuration | what this deployment does: the customer, the routes, the cache ages, the rules, the entities                          | `content/customers/<id>.json`, `content/defaults.json`, `content/rules.rules`, `content/entities/*.json`, the environment |
| code          | how configuration is interpreted: the prompts as functions of the customer, the rule engine, the generator, the tools | `src/lib`                                                                                                                 |

Two anti-patterns kept out: configuration that is really code (a rule table that grew conditionals would be one; the language has 3 conditions and 4 actions, and a rule that needs more is code), and code that is really configuration (the routing table was, until it moved to `content/defaults.json`).

## Three levels, one precedence

| Level                  | Sets                                                        | Where                                               |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| the product's defaults | every task's routes; the age a page is kept                 | `content/defaults.json`                             |
| the customer           | its name, teams, filing, sections; any default it overrides | `content/customers/<id>.json`, chosen by `CUSTOMER` |
| the environment        | a route put first in a task's chain; an outage to rehearse  | `ROUTES`, `OUTAGE`                                  |

`resolve(defaults, overrides, env)` in `src/lib/settings.ts` is the precedence, written once: a customer's value replaces the default's, field by field; an environment route goes first in its task's chain. Every level is parsed by Zod at startup, so a wrong file or a wrong variable stops the start with the field named. A second tenant is a second file: `CUSTOMER=harbor-dental` serves Harbor Dental, its 2 teams, its assistant's name and its own chat route, with no change to code; the test in `src/lib/customer-selection.test.ts` starts the modules under that name and checks all four. User preferences, the third level the brief names, are not here: WorkBot has no users yet.

## The rule language

Day 28's rule table was JSON: a tree of conditions a person could not read in a diff and the model could not be asked to write. It is a language now, one line per rule, in `content/rules.rules`:

```
rule route-finance on ticket when team is missing and text matches "invoice|payment|refund|credit|statement" then set team = "finance"
rule large-invoice on invoice when total over 5000 then flag "Total over $5,000: the finance lead approves"
```

Its grammar, in BNF:

```
rules      ::= rule*
rule       ::= "rule" ident "on" kind "when" conditions "then" action
kind       ::= "contact" | "ticket" | "invoice"
conditions ::= condition ("and" condition)*
condition  ::= ident "matches" string
             | ident "is" "missing"
             | ident "over" number
action     ::= "set" assignment ("," assignment)*
             | "normalize" "phone"
             | "company" "from" "email"
             | "flag" string
assignment ::= ident "=" string
ident      ::= letter (letter | digit | "-" | "_")*        (not a keyword)
string     ::= '"' (escape | any character but '"')* '"'   (\" and \\ are themselves; "\d" is the pattern \d)
number     ::= digit+ ("." digit+)?
comment    ::= "#" to the end of the line
```

`src/lib/rule-language.ts` is the Ohm grammar, which is this BNF with the lexical rules spelled out, and the semantics that build the same objects the engine applied on Day 28; the engine did not change. A text that does not parse fails at startup with its line and column. `printRules` writes a table back as the language, and the Day 28 table printed and parsed is the same table; 20 tests cover the productions, the errors and the round trip. One grammar checks both a person's line and the model's: the language is what the model is asked for, and the parser is the gate.

## The model proposes, a person approves

`pnpm rule "<what the rule should do>"` asks the model for one line in the language, with the grammar, the fields of each kind, the customer's teams and the rules so far in its instructions. A line that does not parse, or routes to a team the customer lacks, goes back to it once with the error. The line is then tried on the last 100 records of its kind, as the rules already left them, and what it would change is listed; `--approve` appends it to the file, which the next start reads. The rule at the end of `content/rules.rules` came this way: asked for tickets about a sync, a webhook or a reconciliation to go to operations, the model wrote `rule route-operations-sync on ticket when team is missing and title matches "sync|webhook|reconcil" then set team = "operations"`, the dry run named the 2 tickets it would change, and a person approved it.

## The generator

`content/entities/<name>.json` describes an entity: its fields, each with a type (text, email, phone, number, choice), whether it is required, its length or its options and default, and who may reach it. `pnpm generate` writes what each becomes:

| From one description  | Generated                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------- |
| the table             | the create statement, in `src/lib/entities/tables.ts`, which the schema spreads               |
| the model             | `src/lib/entities/<name>.ts`: the Zod schemas, the list and create queries                    |
| the route             | `src/app/api/<plural>/route.ts` and `types.ts`, as the hand-written routes are shaped         |
| its test              | `src/app/api/<plural>/route.test.ts`: a create from the required fields, a refusal naming one |
| the page and its form | `src/app/admin/<plural>/page.tsx` and `actions.ts`, under `/admin` for an employee entity     |

`locations` is a description of 24 lines that became 253 lines in 6 files; `vendors` the same. The Day 26 audit counted 10 files touched for a new request field; a field on a generated entity touches 1. `pnpm generate --check` runs first in `pnpm check` and fails when a generated file no longer matches its description, which is how a hand edit to generated code is caught; the generator formats what it writes with the repository's Prettier, so the check compares like with like. Two failure modes the brief names, watched for: a description that grows conditionals (there are none; irregularity belongs in the generator), and generated code edited by hand (the check).

The table statements live in a file that imports nothing. The first version put them in the entity's module, which imports the database, which imports the schema, which imported the module: the statements were read before they existed, and the tables were never made. An import cycle in configuration code fails quietly; the generated test caught it.

## The task graph

The repository is a pnpm workspace of 2 packages, the app at the root and the site in `site/`. Turborepo runs the check over both as a task graph (`turbo.json`): generate:check, lint, typecheck, test and build at the root, lint, typecheck and build in the site, each cached by its inputs, so a task whose inputs did not change since a cached run is not run again. CI restores the cache from the previous run by commit. Measured on this machine: the same work as a sequential chain 32 s; through the graph, cold, with the eight tasks in parallel and Next's own compiler cache warm, 17 s; warm, with nothing changed, 0.2 s and every task restored.

The layout the brief describes, `apps/web`, `apps/api`, `apps/workers` and `packages/schemas`, `config`, `agent`, `integrations`, is the move to make when a second app exists or a second consumer of a package does. WorkBot has one deployable by decision (D15): its API is the app's route handlers, its workers are the Inngest functions the app serves, and a package with one consumer is a layer with no second reader. The move is written down here so it is made once, for a reason, not by default.

## What is not here

- User preferences as a third level: no users.
- A configuration screen: the files are the screen, and Git is the audit.
- A remote cache for Turborepo, and the apps and packages layout, until a second app or consumer arrives.
- A permission check behind an entity's access: placement is the permission today, under `/admin` for employees; Day 30 adds the check.
