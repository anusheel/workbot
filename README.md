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
`DATABASE_URL` in `.env.local` at a Postgres database with the pgvector
extension (`brew install pgvector` for a local one). `.env.example` lists
every variable. `pnpm check` runs what CI runs: lint, types, tests and a
production build of both apps.

`/dashboards` builds a dashboard, form or timeline the user describes, from
a fixed catalog of components and the live request data. The web chat is at
`/chat`, with conversations kept in the browser and what WorkBot learns about
you kept in the database (see `/settings` to forget it), and the same assistant sits in the admin console at `/admin/assistant`. `pnpm chat`
starts it in the terminal, streaming from
Anthropic by default or OpenAI with `--provider openai`, with a calculator,
web page reading, notes and (with a Brave key) web search as tools, and
`/research <question>` for an answer from the company's policies with
citations, and `/investigate <question>` for an agent that searches the
policies, reads them and writes a sourced report. It needs `ANTHROPIC_API_KEY` in `.env.local`; `.env.example` lists
every variable. `pnpm test:live` runs the tests that call the real APIs.

The knowledge base is 52 Markdown documents under `content/knowledge`,
searchable by words out of the box and by meaning with a `VOYAGE_API_KEY`
(`pnpm knowledge:index` rebuilds the index; `pnpm compare:retrieval` answers
10 questions by top-5 retrieval and by the agent, side by side).

`pnpm explain "<question>"` runs the customer-reply pipeline (researcher,
writer, safety editor) on the Claude Agent SDK, which uses your Claude Code
sign-in. `POST /api/intake` turns a message into a triaged request.

`pnpm scrape <url> [--pages n]` pulls supplier records (hours, services,
prices, contact) out of a public page, following its next links; `pnpm browse
--start <url> "<task>"` lets the agent work a site with no API through the
machine's Chrome, one screenshot and one action at a time.
