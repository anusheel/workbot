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
citations, and `/investigate <question>` for the research analyst: a
knowledge-base specialist and a web specialist (pages, the browser agent,
search) under an analyst, every step logged with its agent and time, each
agent's cost shown, and a sourced report at the end. Investigate on a
request's page runs the same analyst and files the report on the ticket. It needs `ANTHROPIC_API_KEY` in `.env.local`; `.env.example` lists
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

`/voice` is the support line in the browser: say what happened, WorkBot asks
what it needs, files the request and says where it went; talk over it and it
listens. On a request's page, Investigate runs the research analyst and
Attach a recording reads a video frame by frame into a timeline you can ask
about (`pnpm video <file>` does the same from the terminal; it needs ffmpeg).

A document files its own request: on the new-request page, or at `POST
/api/documents`, an invoice, an email, a letter or a form (as a PDF, an
image or text) is read into a typed record, filed with the right team, and
kept on the request with its doubtful fields marked. `pnpm extract <file>`
runs the extraction alone; `pnpm extract:eval` measures it on 18 documents.

Documents can also go through the approval workflow at `/admin/inbox`: each
upload is a durable run on [Inngest](https://www.inngest.com) that classifies,
extracts, pauses for a reviewer when a field is doubtful, files the request
and notifies; a morning cron nudges reviewers and checks in on old requests.
Run `pnpm inngest` beside `pnpm dev` for the engine and its dashboard.

Every model call is traced with its tenant, tokens, cost and latency, and
`/admin/traces` shows the last day; the system prompt is versioned at
`/admin/prompts`, with traffic split between versions; `pnpm eval` scores the
assistant against 14 golden cases with a judge model; an hourly watch raises
alerts into the outbox for failures and spend.

How we work with Claude Code, the Codex CLI and OpenCode on this repository, under one policy, is in [docs/agentic-development.md](docs/agentic-development.md); the notes an agent reads first are in [brain/](brain/README.md). The system as built is written up in [docs/architecture.md](docs/architecture.md);
[docs/design/brief-a.md](docs/design/brief-a.md) designs a customer support
platform on the same parts and pitches it.

## Deploy

The app runs on Vercel, the workflows on Inngest Cloud, the database on any
Postgres with pgvector (Neon, for one). In the Vercel project set
`ANTHROPIC_API_KEY`, `DATABASE_URL` and, optionally, the Brave, Voyage and
PostHog keys; install Inngest's Vercel integration, which sets its 2 keys and
syncs the functions on each deploy. Use one project per environment (preview
deployments for staging, a production branch for production), each with its
own database and keys. Run `/pre-deploy` in Claude Code before a release:
it runs the checks and reads the diff for what a deploy would change.
