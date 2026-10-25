# Architecture decisions

The decisions behind the system as built, numbered in the order they were made. Each says what was decided, why, what it costs, and what reversing it would take. A reversed decision stays here, marked superseded, with the date.

## D1. One Postgres database, PGlite embedded for development and tests (Day 5)

Vectors, records and operational data in one store; the same SQL everywhere; `DATABASE_URL=memory://` in tests. Costs: a search-heavy product would want a vector store of its own. To reverse: `src/lib/db.ts` is the only module that knows the driver.

## D2. The AI SDK for the web, the provider SDKs for the terminal (Day 6)

One call shape, middleware and structured output for the product; the wire format in view where the course teaches it. Costs: 2 paths to keep in step. To reverse: `src/lib/chat.ts` adapts one to the other.

## D3. Tools are a Zod schema and a function, defined once (Day 7)

`src/lib/tools.ts`; each provider turns them into its own format. Costs: none found. To reverse: nothing to reverse.

## D4. Our own agent loop, 60 lines, with limits (Day 11)

Steps, dollars and seconds bound every run; a scripted model tests it. Costs: no built-in resumability, which Inngest supplies where it matters. To reverse: swap `runAgent` for a framework's loop behind the same `Tool` type.

## D5. The Claude Agent SDK for the explainer pipeline only (Day 12)

Subagents and hooks where they save code; everywhere else the loop is ours. Costs: a second runtime, on the Claude Code sign-in. To reverse: the pipeline is one file.

## D6. Agentic retrieval over a top-k dump (Day 13)

The model explores the knowledge base with `find`, `ls`, `cat`, `grep`, scoped by section. Costs: more calls per answer than one retrieval; `pnpm compare:retrieval` measures it. To reverse: `find` alone is the classic path.

## D7. The browser agent stays within bounds (Day 14)

Every request from the agent's browser passes the start site or the public-address rule. Costs: no intranet browsing from a public start. To reverse: `bounds` is one function.

## D8. Durable workflows on Inngest for documents; plain requests for chat (Day 18)

A reviewer takes a day; a chat turn takes seconds. Costs: a dev server beside the app; a hosted engine in production. To reverse: the steps are functions; the engine is the serve route and the client.

## D9. Tracing and prompts in our own tables, Langfuse named as the hosted path (Day 19)

No account was available; the records are the same and no content is stored. Costs: no sessions, scores or prompt UI beyond ours. To reverse: `withTrace`/`traced` and `promptOf` are the seams.

## D10. Small model first (Days 6 to 19)

Haiku reads, extracts, judges and runs specialists; Sonnet decides and writes; Opus never by default. Costs: quality on hard documents, caught by the confidence threshold and the reviewer. To reverse: the routing table (D13) is the only place sizes are chosen. Superseded in part on 2026-10-25 by D13: the chat moved to the small model, because the table could not tell the 2 apart.

## D11. One policy for 3 CLIs, instruction files per package (Day 21)

`AGENTS.md` is the source, `CLAUDE.md` imports it; MCP servers declared per CLI from one list; skills shared as commands. Costs: 3 config files to keep in step, which a test checks. To reverse: delete 2 of them.

## D12. The loop stays; LangGraph.js for the first resumable agent, the Claude Agent SDK where Claude Code parity matters (Day 23)

The same research agent on 3 frameworks, 5 topics each (`docs/frameworks.md`): the product keeps its own 90-line loop; the explainer stays on the Claude Agent SDK; LangGraph.js is the choice for an agent that must pause for a person and resume, because its checkpoints live in the Postgres we have and its graph is testable with a scripted model and drawable. The OpenAI Agents SDK is a pattern to copy, not a dependency: we run Anthropic models and the adapter for them is beta. Costs: 3 framework packages in the tree for the comparison. To reverse: `src/lib/frameworks/` is the only place they are imported.

## D13. One routing table per task, the other size behind each; one provider until the second is measured (Day 24)

Every model call names its task; `src/lib/routing.ts` maps it to its models in order, and a call the first cannot take (5xx, 429, unreachable) goes to the next with the same parameters. The rows come from `pnpm routes` (`docs/routing.md`): the small model answers chat (0.83 against 0.87 under one judge, 0.91 against 0.88 under the other, at a twentieth of the price), reads, extracts, triages and judges; the large model lays out pages and writes reports until those have an eval. OpenAI is in the layer and in no route: no key, so no column, so no row. Costs: an outage of the whole provider is still an outage, said in one sentence; a failed first call at each step of a turn, until a circuit breaker remembers. To reverse: the table is one object, and a third entry per row adds the provider.
