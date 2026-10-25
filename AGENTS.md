# WorkBot

An AI assistant and workflow engine for operations, finance and support teams.
Next.js 16 (App Router) in `src/`, TypeScript strict, Tailwind 4, shadcn/ui, pnpm.

## Commands

- `pnpm dev`: the dev server on http://localhost:3000
- `pnpm test`: Vitest, once; `pnpm test -- --watch` while working
- `pnpm check`: lint, types, tests and a production build; CI runs the same on every push
- `pnpm dlx shadcn@latest add <component>`: a UI primitive into `src/components/ui/`

## Conventions

- One day of the course per branch, `day-NN`, merged into `main` through a pull request and kept
- Small commits with honest messages: imperative subject, a short body saying why when the diff does not
- Server Components by default; `"use client"` only for state, effects or browser APIs
- Pages compose shadcn/ui primitives from `src/components/ui/`; the app's own components live in `src/components/`, are kebab-case files exporting a PascalCase name, have a render test beside them and are imported by path
- Route handlers live at `src/app/api/<name>/route.ts` and return JSON
- `src/lib/config.ts` is the only module that reads `process.env`
- Comments say why, never what; no comment restates the line below it
- Prettier formats everything (`pnpm format`); formatting is never a review comment

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
