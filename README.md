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
citations, and `/investigate <question>` for a sourced report: one agent reads the
knowledge base and the web (pages, the browser agent, search), every step
logged with its time and the run priced. Investigate on a request's page
runs the same agent and files the report on the ticket. It needs `ANTHROPIC_API_KEY` in `.env.local`; `.env.example` lists
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
listens. On a request's page, Investigate runs the research agent and
Attach a recording reads a video frame by frame into a timeline you can ask
about (`pnpm video <file>` does the same from the terminal; it needs ffmpeg).

A document files its own request: on the new-request page, or at `POST
/api/documents`, an invoice, an email, a letter, a form or a contract (as a
PDF, a scan, an image, a Word document or text) is read into a typed record,
filed with the right team, and kept on the request with its doubtful fields
marked. A PDF with a text layer goes to the model as its text, a scan as the
file, and a Word contract with its tracked changes kept and listed.
`pnpm extract <file>` runs the extraction alone; `pnpm eval --task extract`
measures it on the eval documents, and `pnpm formats` compares the paths
([docs/documents.md](docs/documents.md)).

The same assistant answers by SMS, WhatsApp and Slack, with one store of
conversations: "Continue on your phone" on the chat page gives a code, and
sending it from WhatsApp carries the conversation on there; an employee links
Slack from settings and is answered there with their role. Any channel can
hand a conversation to a person, as a request with the transcript and where to
reply. `/admin/channels` shows the channels, who has linked, and every message
sent ([docs/channels.md](docs/channels.md)).

Each operation runs as what it is, a request, a stream, a job or a workflow
([docs/execution.md](docs/execution.md)). Jobs share the workers fairly between
senders and leave what still fails at `/admin/jobs`; domain events are read by
their consumers from Postgres; a chat reply resumes after a reload; and
`pnpm realtime` serves live voice calls that staff follow at `/admin/calls`,
on as many instances as needed. `pnpm load` sends 500 documents through the
queue with one noisy sender.

The system is two images and a database, and runs on any cloud
([docs/hosting.md](docs/hosting.md)): `docker compose --env-file .env.compose up --build`
starts it as a major cloud would, with Inngest self-hosted and two realtime
instances, and the evals and the load test run against it from the tools
image. The costs at 1,000 and 100,000 monthly users, the recommendation for
Fieldstone, and the steps for Vercel with Supabase and for Google Cloud
([docs/deploy.md](docs/deploy.md)) are written down.

The infrastructure is Terraform in `infra/` for Google Cloud, a Kubernetes
cluster and an Azure VM, with WorkBot as a Helm chart and `infra/release.sh`
releasing a tag: migrate, wait, smoke, roll back. On a local cluster it scales
on the queue's depth and is recreated from nothing in one sequence
([docs/infrastructure.md](docs/infrastructure.md)).

A spreadsheet too large for a prompt goes to `/admin/sheets`: it loads into a
DuckDB of its own, its totals row is checked against its rows, and a question
is answered by SQL the model writes, shown under the answer with the rows it
returned.

Documents can also go through the approval workflow at `/admin/inbox`: each
upload is a durable run on [Inngest](https://www.inngest.com) that classifies,
extracts, pauses for a reviewer when a field is doubtful, files the request
and notifies; a morning cron nudges reviewers and checks in on old requests.
Run `pnpm inngest` beside `pnpm dev` for the engine and its dashboard.

Every model call is traced with its tenant, tokens, cost and latency, and
`/admin/traces` shows the last day; the system prompt is versioned at
`/admin/prompts`, with traffic split between versions; an hourly watch raises
alerts into the outbox for failures and spend.

The evals are the development loop: 35 chat cases (answers, refusals,
escalations, actions checked by the tool they must call, and safety cases),
30 documents and 32 triage messages, each saying whether it was written by
hand, sampled from what people sent, or generated and reviewed. `pnpm eval`
runs them on the production routes with a judge that is never the model under
test (calibrated against 20 hand-labeled replies); `--gate` fails on a hard
failure or a mean under 0.7 and warns of a regression against the last
recorded run, in CI on every pull request that touches a prompt, a tool, a
model or an eval, in the fleet's merge queue, and in the terminal; the full
suite runs nightly and `/admin/evals` is the scoreboard. How it all fits is in
[docs/evals.md](docs/evals.md).

Every model call is routed by task: `src/lib/routing.ts` maps chat,
generation, research, summaries, extraction, triage, reading and judging to a
provider and a size, with the model that takes over when the first is down or
rate-limited; `pnpm routes` scores each task's eval on each provider's models
with cost and p95 latency, and [docs/routing.md](docs/routing.md) holds the
table and the routing chosen from it. `OUTAGE=claude-haiku-5-5 pnpm dev`
rehearses an outage: the chat answers on the fallback and the traces show
both calls.

`pnpm frameworks` runs the research agent on LangGraph.js, the Claude Agent SDK and the OpenAI Agents SDK, on 5 questions, and prints time, tool calls, tokens and cost per run; the comparison and the choice are in [docs/frameworks.md](docs/frameworks.md).

The company WorkBot works for is configuration: `content/customer.json` names it, its teams and what each files, and the prompts and the request model read it, so a new customer is a new file. The principles the code is held to are in [brain/architecture/principles.md](brain/architecture/principles.md), with the audit behind them in the architecture document.

The ticketing system is connected through its MCP server: `src/lib/mcp.ts` is the client, the issues are pulled every 15 minutes into a `tickets` table the assistant searches (`/admin/tickets` shows the copy and pulls on demand), and `file_ticket` and `comment_on_ticket` write through the server once per key, with a dry run. `GITHUB_TOKEN` and `GITHUB_REPO` turn it on; the 3 routes to a customer's systems are compared in [docs/integrations.md](docs/integrations.md).

Under the integrations is one shape per concept: `src/lib/unified.ts` maps GitHub issues and WorkBot requests to tickets, and document senders and ticket logins to contacts, with the provider's record in `raw`; `content/rules.rules` is applied to every record before the model sees it, with each change written on the row; the copy is refreshed by the 15-minute pull, by a signed webhook delivery at `/api/webhooks/github`, and by a nightly read of everything that logs what the other paths missed; page reads are cached per tenant with their fetch time in the answer. The measurements and what is not built are in [docs/data-layer.md](docs/data-layer.md).

Behavior is configuration: `CUSTOMER` names the file in `content/customers` a deployment serves, `content/defaults.json` holds the routes and ages the product starts from, and `src/lib/settings.ts` resolves the two with the environment in one place. The rules are a language (`content/rules.rules`, grammar in [docs/config.md](docs/config.md)); `pnpm rule "<what it should do>"` asks the model for one, tries it on the copy and, with `--approve`, adds it. An entity is a description in `content/entities`, and `pnpm generate` writes its table, model, route, test and page; `pnpm check` runs as a Turborepo task graph and fails first when a generated file drifts from its description.

People and services sign in with keys (`pnpm users add <name> --role viewer|agent|admin`, then `/sign-in`); a viewer reads, an agent also acts, an admin also administers. Every page, action, route and tool checks the role, each customer's rows are separated by row-level security in Postgres, integration tokens are sealed at rest, and 20 injection attempts run as `pnpm eval --task security`. The note for a customer's security review is [docs/security.md](docs/security.md).

How we work with Claude Code, the Codex CLI and OpenCode on this repository, under one policy, is in [docs/agentic-development.md](docs/agentic-development.md); the notes an agent reads first are in [brain/](brain/README.md). A fleet of agents on the backlog is `scripts/fleet.mjs`; what it did on 50 tasks is in [docs/fleet.md](docs/fleet.md). The system as built is written up in [docs/architecture.md](docs/architecture.md);
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
