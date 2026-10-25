# WorkBot

An AI assistant and workflow engine for operations, finance and support teams.
Next.js 16 (App Router) in `src/`, TypeScript strict, Tailwind 4, shadcn/ui, pnpm. The public
site is a second app in `site/`, with its own AGENTS.md.

## Commands

- `pnpm dev`: the dev server on http://localhost:3000; without `DATABASE_URL` it runs on an embedded database in `.data/pg`
- `pnpm chat`: the admin assistant in the terminal, with tools; `--provider`, `--model`, `--effort`, `--temperature`; `/research <question>` for a cited answer from the policies
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
- Memory is per visitor in `src/lib/memory.ts`: a small model extracts durable facts after each reply, the system prompt carries them, and `/settings` lets the person forget them. Long conversations are cut to a budget by `src/lib/context.ts`, which summarizes what it drops
- Product events go through `track` in `src/lib/analytics.tsx`: snake_case names, properties that identify records, never people
- A folder with its own rules has a `CLAUDE.md` beside the files: `src/app/api/` for routes, `content/policies/` for policies
- Comments say why, never what; no comment restates the line below it
- Prettier formats everything (`pnpm format`); formatting is never a review comment

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
