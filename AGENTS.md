# WorkBot

An AI assistant and workflow engine for operations, finance and support teams.
Next.js 16 (App Router) in `src/`, TypeScript strict, Tailwind 4, shadcn/ui, pnpm. The public
site is a second app in `site/`, with its own AGENTS.md.

## Commands

- `pnpm dev`: the dev server on http://localhost:3000; without `DATABASE_URL` it runs on an embedded database in `.data/pg`
- `pnpm chat`: the admin assistant in the terminal, with tools; `--provider`, `--model`, `--effort`, `--temperature`; `/research <question>` for a cited answer from the policies, `/investigate <question>` for the analyst's sourced report, with its log and cost by agent
- `pnpm explain "<question>"`: the customer-reply pipeline on the Claude Agent SDK, which uses your Claude Code sign-in
- `pnpm scrape <url> [--pages n]`: typed records out of a public page; `pnpm browse --start <url> "<task>"`: the browser agent, on the machine's Chrome
- `pnpm knowledge:index`: rebuild the knowledge base index; `pnpm compare:retrieval`: 10 questions by top-5 retrieval and by the agent, side by side
- `pnpm test`: Vitest, once; `pnpm test -- --watch` while working
- `pnpm test:live`: the tests that call the real APIs, on the small models, with the keys in `.env.local`; run it before pushing a change to a prompt or a provider
- `pnpm check`: lint, types, tests and a production build, for both apps; CI runs the same on every pull request and on `main`
- `pnpm --filter workbot-site dev`: the public site on http://localhost:3001
- `pnpm dlx shadcn@latest add <component>`: a UI primitive into `src/components/ui/`

## Claude Code

Skills in `.claude/skills/`: `/component <Name>`, `/api-route <name>`, `/pre-deploy`, and `/review [pr]`, which runs the 3 reviewers in `.claude/agents/` in parallel. A hook in `.claude/settings.json` formats every file Claude edits. The backlog is mirrored in `docs/backlog.md` so agents can read tickets by path.

## Tooling for agents

`.mcp.json` registers Linear, GitHub and Figma, plus 2 servers from this
repository: `database` (read-only SQL, schema, samples) and `posthog` (which
events fired). Their logic is in `src/mcp/` with in-process tests; the entries
in `mcp/` only connect them to stdio. Both read `.env.local`.

## Conventions

- One day of the course per branch, `day-NN`, merged into `main` through a pull request and kept
- Small commits with honest messages: imperative subject, a short body saying why when the diff does not
- Server Components by default; `"use client"` only for state, effects or browser APIs
- Pages compose shadcn/ui primitives from `src/components/ui/`; the app's own components live in `src/components/`, are kebab-case files exporting a PascalCase name, have a render test beside them and are imported by path
- Route handlers live at `src/app/api/<name>/route.ts` and return JSON
- `src/lib/config.ts` is the only module that reads `process.env`; `.env.example` lists the variables, required ones uncommented
- `src/lib/db.ts` is the only module that knows the database driver; everything else calls `query` with `$n` parameters, never values spliced into SQL
- A schema change is one idempotent statement appended to `src/lib/schema.ts`
- Pure models (schemas, constants, labels) live in `src/lib/<name>-model.ts` so client components can import them; queries stay in `src/lib/<name>.ts`
- Model calls go through `src/lib/providers.ts`; model ids and prices live there and nowhere else. WorkBot's persona and rules are `src/lib/system-prompt.ts`
- The web chat is `src/components/chat.tsx` on `useChat` from the AI SDK, against `src/app/api/chat/route.ts`; `src/lib/chat.ts` adapts the provider and the tool registry to the SDK. `CHAT_PROVIDER` and `CHAT_MODEL` choose the model
- Generated pages come from json-render: `src/lib/catalog.ts` is everything the model may put on screen, `src/components/generated-ui.tsx` implements each entry; the generate route gives the model live numbers so it lays out data rather than inventing it
- Tools the model can call are defined once in `src/lib/tools.ts` as a Zod schema plus a function, and say in their description when to call them; each provider turns them into its own format. Steps of a chain are plain functions in `src/lib`, one model call each
- The knowledge base is `content/knowledge/<section>/<slug>.md`; `src/lib/knowledge.ts` reads it, indexes each heading as a chunk (full-text always, embedded when there is a Voyage key) and offers find, ls, cat and grep. Agents explore it with those 4 tools rather than receiving a top-k dump. The tools are scoped by section: employees get everything, the web chat gets the customer-facing sections until there is a sign-in; `pnpm knowledge:index` rebuilds the index
- Agents are loops in `src/lib/agent.ts` over the AI SDK's one-call primitive: the model proposes tool calls, the loop runs them, appends the results and asks again, under step, cost and time limits. An agent is a system prompt, a tool list and a terminal tool. `src/lib/investigate.ts` is an analyst that delegates to a knowledge-base specialist and a web specialist (page text, the browser agent, search), each a tool that runs its own loop on the small model; the 3 share one list of findings, every step is logged with its agent and time, each agent's spend is priced, and the report is filed on the request (`src/lib/reports.ts`)
- Multi-agent pipelines run on the Claude Agent SDK (`src/lib/explainer.ts`): subagents are definitions (description, prompt, tools, model), the orchestrator's system prompt is the workflow, guardrails are hook callbacks that can send a result back, and every tool call is traced. The intake workflow (`src/lib/intake.ts`) is a plain function: triage with a small model, then a request for a person to review
- The web is read 2 ways: `src/lib/scrape.ts` turns a page's text into records of a Zod schema and follows its next link; `src/lib/browser-agent.ts` is a screenshot-then-one-action loop over a small `Browser` interface, tested with a fake browser and run on the machine's Chrome
- Memory is per visitor in `src/lib/memory.ts`: a small model extracts durable facts after each reply, the system prompt carries them, and `/settings` lets the person forget them. Long conversations are cut to a budget by `src/lib/context.ts`, which summarizes what it drops
- Product events go through `track` in `src/lib/analytics.tsx`: snake_case names, properties that identify records, never people
- A folder with its own rules has a `CLAUDE.md` beside the files: `src/app/api/` for routes, `content/knowledge/` for the knowledge base
- Comments say why, never what; no comment restates the line below it
- Prettier formats everything (`pnpm format`); formatting is never a review comment

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
