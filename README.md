# WorkBot

An AI assistant and workflow engine for a company's operations, finance and
support teams, and for the customers they serve.

Built day by day on Plank's [AI FDE Course](https://joinplank.com/ai-fde-course).
Each day is a branch, `day-01` to `day-40`, merged into `main` through a pull
request and kept, so any day's code can be read on its own. The record of each
day is at [joinplank.com/fde/anusheel](https://joinplank.com/fde/anusheel).

## Run it

    pnpm install
    pnpm dev

Without a `DATABASE_URL`, the app runs on an embedded Postgres (PGlite) in
`.data/pg`, and the tests on an in-memory one. For a server, point
`DATABASE_URL` in `.env.local` at a Postgres database. `.env.example` lists
every variable. `pnpm check` runs what CI runs: lint, types, tests and a
production build of both apps.

`pnpm chat` starts WorkBot's assistant in the terminal, streaming from
Anthropic by default or OpenAI with `--provider openai`, with `/model`,
`/system` and `/cost` commands. It needs `ANTHROPIC_API_KEY` in `.env.local`.
`pnpm test:live` runs the tests that call the real APIs.
