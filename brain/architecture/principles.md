# Principles

What the code is held to from Day 26 on, as a reviewer reads a design or a pull request. Each is a sentence and a test; the reasons are in `docs/architecture.md`, the audit of Day 26.

1. **One deployable, and the static site.** A network boundary only where scaling or isolation forces one. Test: a change ships with one deploy.
2. **Postgres, and JSONB for what the model shapes.** One query language, transactions, joins and constraints; a document's record, a finding, a scene are JSONB because the model decides their shape. Test: no second store without a measured need.
3. **Tools over retrieval.** The agent finds and reads with tools; embeddings are one tool among several. Test: a question answered with a document named, not a top-k dump.
4. **Thin routes and plain functions.** A route parses, calls a function in `src/lib`, returns JSON; a function calls `query` with `$n` parameters. Test: no file whose only job is to call another.
5. **One agent, unless an eval shows a second helps.** A pipeline of fixed stages where the stages are fixed; a second agent only with the comparison on record. Test: `pnpm compare:agents`, or its like, before a delegation ships. Its first application: the research analyst's 2 specialists, measured at 0.73 for $0.018 a question against one agent's 0.92 for $0.0016 on the small model, went (Day 26); the explainer's 3 subagents are next.
6. **Configuration for what varies by customer, route or version.** The customer (`content/customer.json`), the routes (`src/lib/routing.ts`), the prompt versions (the `prompts` table); code interprets configuration. Test: a new customer is a new file.
7. **Boring technology.** Postgres, Inngest, Vercel, a browser, ffmpeg. Test: a new dependency names what it replaces and what it costs.

The 4 questions of any review: how many places does adding a field touch; what happens when a provider is down; can one engineer run the whole thing locally; can an agent regenerate this part from configuration.
