# Backlog

The Linear workspace for WorkBot, mirrored here so agents can read it by path.
One ticket per small change. The acceptance criteria are what the review
checks. Sizes: S is under an hour, M is a few hours.

| Ticket | Title                                                                                                                             | Size | Status |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| WB-1   | Landing page                                                                                                                      | S    | done   |
| WB-2   | Health endpoint                                                                                                                   | S    | done   |
| WB-3   | Deployment settings page                                                                                                          | S    | done   |
| WB-4   | CI on every pull request                                                                                                          | S    | done   |
| WB-5   | Request model with validation                                                                                                     | S    | done   |
| WB-6   | Intake form                                                                                                                       | M    | done   |
| WB-7   | Requests list                                                                                                                     | S    | done   |
| WB-8   | Requests API                                                                                                                      | S    | done   |
| WB-9   | Admin console shell                                                                                                               | S    | done   |
| WB-10  | Request counts on the admin overview                                                                                              | S    | done   |
| WB-11  | Settings inside the admin console                                                                                                 | S    | done   |
| WB-12  | Request detail page                                                                                                               | S    | done   |
| WB-13  | Change a request's status                                                                                                         | S    | done   |
| WB-14  | Filter requests by team and status                                                                                                | S    | done   |
| WB-15  | Policies as Markdown documents                                                                                                    | M    | done   |
| WB-16  | Public site scaffold                                                                                                              | S    | done   |
| WB-17  | Postgres persistence for requests                                                                                                 | M    | done   |
| WB-18  | Analytics on the intake funnel                                                                                                    | S    | done   |
| WB-19  | Validation messages from the API in the UI                                                                                        | S    | open   |
| WB-20  | Request detail: comments                                                                                                          | M    | open   |
| WB-21  | Admin assistant in the terminal                                                                                                   | M    | done   |
| WB-22  | Tools for the assistant                                                                                                           | M    | done   |
| WB-23  | Research with citations                                                                                                           | M    | done   |
| WB-24  | Web chat                                                                                                                          | M    | done   |
| WB-25  | Assistant in the admin console                                                                                                    | S    | done   |
| WB-26  | Generated dashboards, forms and timelines                                                                                         | M    | done   |
| WB-27  | Memory of the person across conversations                                                                                         | M    | done   |
| WB-28  | Long conversations within budget                                                                                                  | S    | done   |
| WB-29  | Investigation agent                                                                                                               | M    | done   |
| WB-30  | Explainer pipeline for customer replies                                                                                           | M    | done   |
| WB-31  | Intake workflow: triage to the queue                                                                                              | S    | done   |
| WB-32  | Knowledge base of 50 or more documents                                                                                            | M    | done   |
| WB-33  | Agentic retrieval tools                                                                                                           | M    | done   |
| WB-34  | Scraper for supplier pages                                                                                                        | S    | done   |
| WB-35  | Browser agent for portals with no API                                                                                             | M    | done   |
| WB-36  | Research analyst: the investigation with specialists, filed on the ticket                                                         | M    | done   |
| WB-37  | Voice intake line                                                                                                                 | M    | done   |
| WB-38  | Recordings read into tickets                                                                                                      | M    | done   |
| WB-39  | Extraction engine                                                                                                                 | M    | done   |
| WB-40  | Document intake                                                                                                                   | S    | done   |
| WB-41  | Document approval workflow                                                                                                        | M    | done   |
| WB-42  | Scheduled check-ins and reminders                                                                                                 | S    | done   |
| WB-43  | Tracing with cost per tenant                                                                                                      | M    | done   |
| WB-44  | Prompts outside the code                                                                                                          | S    | done   |
| WB-45  | Evals and alerting                                                                                                                | M    | done   |
| WB-46  | Deployment                                                                                                                        | S    | open   |
| WB-47  | The architecture written up, and a design pitched                                                                                 | M    | done   |
| WB-48  | One policy across 3 CLIs, the company brain, the way of working                                                                   | M    | done   |
| WB-49  | A fleet of 50 tasks: the dispatcher, the review fleet, the batched queue                                                          | M    | done   |
| WB-50  | The research agent on 3 frameworks, compared on 5 topics                                                                          | M    | done   |
| WB-51  | Two providers behind one layer, routed per task, with a fallback that keeps WorkBot up                                            | M    | done   |
| WB-52  | Evals as the development loop: 30 cases a task, a calibrated judge, the gate in CI, the scoreboard                                | M    | done   |
| WB-53  | Audited against the principles; the customer in configuration; one agent where the eval allows                                    | M    | done   |
| WB-54  | The ticketing system through its MCP server: the sync, 3 product-level tools, the routes compared                                 | M    | done   |
| WB-55  | One shape for tickets and contacts, 3 sync paths, the rule table, a cache with its freshness                                      | M    | done   |
| WB-56  | Config-first: three levels, the rule language and the model's proposals, the entity generator, the task graph                     | M    | done   |
| WB-57  | Security: roles and keys, tenants in the database, tools checked below the model, sealed tokens, injection evals                  | M    | done   |
| WB-58  | Documents and spreadsheets: formats by their bytes, two paths for a PDF, tracked changes, SQL over 50,000 rows                    | M    | done   |
| WB-59  | One agent on 4 channels: conversations on the server, identities linked by a code, Twilio, Slack, a hand-off                      | M    | done   |
| WB-60  | Execution models: every operation classified, fair jobs with dead letters, events in Postgres, resumable chat, live calls         | M    | done   |
| WB-61  | Cloud services: two images, a stack shaped like a cloud, costs at two scales, a recommendation, the deployments written           | M    | done   |
| WB-62  | Infrastructure as code: Terraform on three targets, a Helm chart, releases with smoke and rollback, the pipeline                  | M    | done   |
| WB-63  | Isolation and scale: tiers, egress allowlist, KMS keys, the single tenant, four bottlenecks, runbooks, the questionnaire          | M    | done   |
| WB-64  | Ship to a customer: the release checklist, a review pack, five usability sessions, the top findings shipped                       | M    | done   |
| WB-65  | Growth: the site for answer engines, citations measured weekly, a scored target list, compliant outreach                          | M    | done   |
| WB-66  | Analytics and research: metrics in SQL with tests, a weekly report, an analyst that shows its SQL, a market dossier               | M    | done   |
| WB-67  | Final release: deployed by the pipeline into the isolated environment, the architecture and its numbers, a recorded demonstration | M    | done   |

## Acceptance criteria

### WB-5 Request model with validation

- A request has a title (3 to 120 characters), details (up to 5,000), a team (operations, finance, support), a priority (low, normal, high; default normal), a status (open, in progress, done; new requests are open) and a creation time
- The Zod schema is the one source of these rules; types derive from it
- Unit tests cover trimming, defaults and rejection

### WB-6 Intake form

- `/requests/new` submits through a Server Action; invalid input shows the message under the field, valid input redirects to `/requests`
- Works without JavaScript for the valid path
- Team and priority are selects populated from the model's lists

### WB-7 Requests list

- `/requests` shows every request, newest first, with team, priority and status
- An empty state when there are none
- Links to the intake form

### WB-8 Requests API

- `POST /api/requests` creates a request from JSON and answers 201 with it; invalid input answers 400 with field errors; a non-JSON body answers 400
- `GET /api/requests` lists requests, newest first
- Request and response schemas live in `types.ts` beside the route; tests cover each method and one invalid input

### WB-9 Admin console shell

- `/admin` has a layout with side navigation; pages render inside it
- The header and the landing page link to it

### WB-10 Request counts on the admin overview

- `/admin` shows the number of requests in each status and the 5 latest requests

### WB-11 Settings inside the admin console

- The deployment settings page moves to `/admin/settings`; the old address is gone

### WB-12 Request detail page

- `/requests/<id>` shows a request in full; an unknown id is a 404

### WB-13 Change a request's status

- The detail page offers the next statuses as actions; the list reflects the change without a reload of the data layer

### WB-14 Filter requests by team and status

- `/requests?team=&status=` narrows the list; the filters are links, so they work without JavaScript

### WB-15 Policies as Markdown documents

- Company policies live as Markdown files with front matter; `/policies` lists them and `/policies/<slug>` renders one

### WB-16 Public site scaffold

- A second app, `site/`, for the public marketing site, in the same workspace with the same checks

### WB-17 Postgres persistence for requests

- Requests survive a restart; the schema is applied idempotently at startup; tests run against a real database engine

### WB-18 Analytics on the intake funnel

- Viewing the form, submitting it and the outcome are tracked as product events with no personal data

### WB-19 Validation messages from the API in the UI

- A client of the API shows field errors from the 400 response next to the field

### WB-20 Request detail: comments

- A request has comments with an author and a time; the detail page lists them and accepts a new one

### WB-21 Admin assistant in the terminal

- `pnpm chat` streams a conversation with WorkBot's system prompt; `--provider` picks Anthropic or OpenAI, `--model`, `--effort` and `--temperature` tune the call
- `/model` switches provider or model mid-conversation and the history carries on; `/system` shows or replaces the prompt; `/cost` reports tokens and dollars for the session
- Rate limits are retried by the SDK; other errors are shown and the failed turn leaves no trace in the history

### WB-22 Tools for the assistant

- 4 tools: a calculator, reading a web page, saving a note, and web search when a Brave key is set; each is one Zod schema and one function in `src/lib/tools.ts`
- The loop runs on both providers: the model's tool calls are validated, run, and answered in the same turn, up to 8 rounds; invalid input and failures go back to the model as errors
- The terminal shows each call and its input as it happens

### WB-23 Research with citations

- `/research <question>` answers from the company's policies, and from the web when search is configured, in 4 model calls: plan the sources (small model), read them, extract the relevant facts from each (large model), write the answer (large model)
- Every fact in the answer carries a numbered citation and the sources are listed at the end; when the sources do not answer, the reply says what is missing and which team to ask
- The session's `/cost` includes every call the chain made

### WB-24 Web chat

- `/chat` streams replies from `/api/chat`, which runs the configured model with the assistant's tools through the AI SDK
- Replies render as Markdown with highlighted code blocks that can be copied; each tool call shows its state while it runs and its result when done
- Conversations are kept in the browser: a list to switch between, a new chat, titles from the first question

### WB-25 Assistant in the admin console

- `/admin/assistant` shows the same chat in a panel of the console, on the same route handler

### WB-26 Generated dashboards, forms and timelines

- `/dashboards` turns a description into a page composed from a catalog of 22 components: layout, metrics, tables, 3 chart kinds, a timeline, tabs and form fields
- The route hands the model the live request counts and latest requests; the page fills in as the JSON streams, and a follow-up description edits the page on screen
- Tabs switch through state; a generated form creates a request through the `submit_request` action

### WB-27 Memory of the person across conversations

- After each reply, a small model extracts up to 3 durable facts about the person (preferences, the people and systems they work with, the cases they are on); duplicates are not stored
- The next conversation's system prompt carries what is known
- `/settings` lists memories by kind; each can be forgotten, or all at once

### WB-28 Long conversations within budget

- Before each reply the history is cut to a token budget: the first message and the most recent ones stay, and a small model summarizes the rest into the system prompt

### WB-29 Investigation agent

- `/investigate <question>` in the terminal runs an agent loop written in the repository: the model searches the knowledge base and, with a search key, trusted web sources, reads what it finds, saves findings with their source and ends by writing a sourced summary
- Guards: 15 steps, a dollar limit and a timeout; the loop stops with what it has and says why
- Reasoning, tool calls and results stream as they happen; tests drive the loop with a scripted model

### WB-30 Explainer pipeline for customer replies

- `pnpm explain "<question>"` runs researcher (small model, knowledge base tools), writer and safety editor as Claude Agent SDK subagents under an orchestrator; the editor sends drafts back with numbered edits, at most twice
- Guardrails in code: a researcher answer without sources and an editor verdict without specific edits are rejected and rerun
- Every tool call and handoff is traced with its agent and time; the run reports turns and cost

### WB-31 Intake workflow: triage to the queue

- `POST /api/intake` takes a message from any channel; a small model writes the title, keeps the body in the sender's words and picks team and priority; the request lands in the queue for a person to review

### WB-32 Knowledge base of 50 or more documents

- `content/knowledge` holds the policies, operations and finance manuals, IT how-tos, customer FAQs and HR documents, 52 in all, each with front matter and headings; the policies pages read the `policies` section
- Each heading is indexed as a chunk with full-text search, and with a Voyage embedding when a key is set; the index builds itself on first use and `pnpm knowledge:index` rebuilds it

### WB-33 Agentic retrieval tools

- The assistant and the agents get find (by meaning or words), ls, cat and grep over the knowledge base, and explore it coarse to fine instead of receiving a top-k dump
- The tools are scoped by section: the terminal assistant and the agents read everything; the web chat, a public surface until sign-in exists, reads the FAQ and policies only
- `pnpm compare:retrieval` runs 10 questions through top-5 retrieval and through the agent, for a side-by-side table

### WB-34 Scraper for supplier pages

- `pnpm scrape <url> [--pages n]` reads a public page, reduces it to text and has the small model return every record that fits a Zod schema; the schema is the contract and Zod checks the result
- Pagination follows the page's `rel=next` link or its "next" or "more" link, up to the pages asked
- Pages come through the same guarded fetch as the assistant's web tool: public addresses only, every redirect checked, the body read only as far as the cap

### WB-35 Browser agent for portals with no API

- `pnpm browse --start <url> "<task>"` opens the machine's Chrome headless through Playwright and loops: screenshot, one action from the model (click, type, press, scroll, wait, goto, done or give_up, each with a reason), repeat, within a step limit
- The browser is an interface of 9 methods, so the unit test drives the loop with a fake browser and a scripted model; the live test works a legacy invoice portal fixture with the small model
- Pages are untrusted: every request the browser makes is checked against the start site and the public-address rule of the web tool, so a page cannot steer the agent onto this machine or a private network

### WB-36 Research analyst: the investigation with specialists, filed on the ticket

- `/investigate` in the terminal and Investigate on a request's page run an analyst that delegates: ask_knowledge_base runs a specialist over the knowledge base tools, ask_web a specialist with read_url, the browser agent as browse_site and web_search when a key is set; all 3 agents save findings to one list, and the analyst ends with write_report
- browse_site tries the browser once more when it fails, then falls back to the page's text, so a browser that will not start costs a page its clicks, not the run
- Every thought, tool call and result is logged with its agent and time; each agent's spend is priced and the total shown; the report, its findings and its cost are saved on the request and shown under Research

### WB-37 Voice intake line

- `/voice` runs the support line in the browser: the caller speaks, WorkBot asks what it needs to know one question at a time, files the request through the intake workflow and says where it went; the caller can talk over it, and the line stops speaking and listens
- The call is a state machine in `src/lib/voice-model.ts` (idle, listening, thinking, speaking) with its own tests; the browser's speech recognition and synthesis sit behind a 2-method listener and a 2-method speaker, so a hosted provider can replace either
- A waveform shows the microphone is live; without speech services the same conversation is typed, against the same `POST /api/voice`

### WB-38 Recordings read into tickets

- Attach a recording on a request's page: ffmpeg takes 1 frame every 2 seconds, scaled to at most 1024 pixels wide, the small model describes each batch of frames, writes the timeline, and the recording is filed on the ticket with what every frame showed
- A question box under each recording answers from the frame descriptions; `pnpm video <file> [--every n] [--ask "<question>"]` runs the same pipeline from the terminal
- Recordings carry no transcript: audio needs a hosted speech-to-text provider, which this build does not have

### WB-39 Extraction engine

- `extract(source, schema, model)` turns a document (text, a page, or a PDF or image file) into the record a Zod schema describes: one schema serves both providers through the AI SDK's `Output.object`; an output that does not fit goes back to the model with the reason, up to 3 times
- Each top-level field comes back with the model's confidence, and the fields under 0.7 are listed for a person to check
- 4 schemas in `src/lib/document-model.ts`: invoice, email, letter or form, and job posting; `pnpm extract <file or url> [--as kind]` runs one from the terminal
- `pnpm extract:eval` runs the 18 documents in `content/eval/documents` (invoices as PDFs, forms and letters as images, emails and job postings as text) against their expected records and prints the accuracy by document and in all

### WB-40 Document intake

- `POST /api/documents` (JSON text or address, or a file as form data) and "File it from a document" on the new-request page classify the document, extract its record and file a request for the right team: invoices to finance, complaints and questions to support, the rest to operations, with the priority from the email's urgency
- The record is kept on the request and shown under Documents, field by field, with the doubtful fields marked Check

### WB-41 Document approval workflow

- A document uploaded to the inbox (`/admin/inbox`, up to 10 at once) is a run of a durable workflow on Inngest: classify, extract, validate, a reviewer when a field is doubtful, store as a request, notify; each step is checkpointed and retried up to 3 times, and the wait for the reviewer holds no server
- The inbox shows every document's status; Approve and Reject send the event the paused run waits for; the record is filed on the request as on Day 17
- Notifications are an outbox in the database, shown on the inbox page; a mail or chat integration would drain it

### WB-42 Scheduled check-ins and reminders

- A cron function runs every morning: a nudge for each review nobody has answered in a day, a check-in on each request open for a week, one step per notification; "Run the reminders now" triggers it on demand

### WB-43 Tracing with cost per tenant

- Every model call goes through `src/lib/tracing.ts`: a middleware on the AI SDK model records tokens, cached tokens, dollars (a cache read at a tenth of the input price, a twentieth on Sonnet and Opus 5.5, a write at 1.25 times), latency and failure, under the request's tenant (a visitor, `api`, `admin`, `workflow`, `terminal`) and purpose; the terminal's calls are recorded from the session
- `/admin/traces`: the last 24 hours as calls, spend, error rate, p50 and p95, spend by tenant, spend and latency by prompt version, and the latest calls; nothing of a call's content is stored

### WB-44 Prompts outside the code

- The assistant's system prompt lives in the `prompts` table, versioned; the code's text seeds version 1. `/admin/prompts` adds a version and splits traffic between versions by share; a visitor always lands on the same version, and the trace records which one answered
- The chat route marks the prompt for the provider's cache, so a repeated prefix is read at a fraction of the input price

### WB-45 Evals and alerting

- `content/eval/golden.json`: 12 golden cases, answers, escalations and refusals, each with criteria and forbidden phrases; `pnpm eval [--prompt name@version] [--runs n]` answers each with the assistant's tools, scores them with a judge model after the programmatic check, and prints mean and spread per case and in all
- An hourly watch raises an alert in the outbox when more than a tenth of an hour's calls failed, or a day's spend is over the budget (`ALERT_DAILY_DOLLARS`)
- `POST /api/chat` is rate limited per visitor: 20 messages in 5 minutes, 429 past it

### WB-46 Deployment

- Vercel for the app, Inngest Cloud for the workflows, a Postgres with pgvector for the database; the keys per environment in `.env.example`, the steps in the README, and `/pre-deploy` before each release

### WB-47 The architecture written up, and a design pitched

- `docs/architecture.md`: the system as built after Day 19, in one diagram, with the agents and their patterns, where each kind of data lives, the technology and why, the tradeoffs, and what reliability is built and what is missing
- `docs/design/brief-a.md`: the design for an AI customer support platform at 10,000 tickets a day: 3 workflows, 4 agents, the data and the technology, the tradeoffs, 5 features by impact and effort with the MVP, what to promise and what to caveat, and the 5-minute pitch

### WB-48 One policy across 3 CLIs, the company brain, the way of working

- `AGENTS.md` at the root and in `site/`, `src/app/api/` and `content/knowledge/`, each with a `CLAUDE.md` importing it; the MCP servers declared once per CLI from the same list (`.mcp.json`, `.codex/config.toml`, `opencode.jsonc`); the same permission policy in each; the skills as Codex skills and OpenCode commands pointing at the same files; `scripts/agent-config.test.ts` fails when they drift
- `brain/`: the product, the architecture decisions, the customer and the style notes, with an index, `Reviewed` dates and a retention rule; the root `AGENTS.md` points at it
- An issue form with acceptance criteria and constraints, a pull request template with the brief, the plan, the sessions and the checks; `docs/agentic-development.md` records the policy, the workflow and what each CLI was faster or clearer at on the day's 3 tasks

### WB-49 A fleet of 50 tasks: the dispatcher, the review fleet, the batched queue

- `docs/fleet-tasks.md`: 50 tasks with a goal, criteria, constraints, files and the test to write first, no two changing the same file, filed as issues by `scripts/fleet.mjs file`
- `scripts/fleet.mjs`: an agent per task in a worktree or a cloud session, the pull requests the cloud cannot open, a board of every task's state, a queue that reviews in batches with the 4 reviewers, merges with the agent's commit message, checks the branch and reverts what broke it, and sends a review that requests changes or a failed check back to one more session
- `.claude/agents/brief-reviewer.md` and `/review` with 4 reviewers and a verdict line
- `docs/fleet.md`: the numbers, the task shapes that worked and the ones that did not, what a person did, the next backlog

### WB-50 The research agent on 3 frameworks, compared on 5 topics

- One set of 4 tools (`web_search`, `read_url`, `save_finding`, `write_report`) and one system prompt; the same agent on LangGraph.js (plan, a research loop through the tools, write, a checkpointer so a thread resumes after the process is killed), the Claude Agent SDK (one agent with the tools and a hook on every tool call) and the OpenAI Agents SDK (a Researcher that hands off to a Writer, behind a guardrail on the topic)
- `pnpm frameworks` runs all 3 on the 5 topics and records wall time, tokens, cost and tool calls per run
- `docs/frameworks.md`: what each made easier and harder, and the choice, recorded in the architecture document with the 2 reasons that decided it

### WB-51 Two providers behind one layer, routed per task, with a fallback that keeps WorkBot up

- `src/lib/routing.ts`: 8 tasks, each mapped to the models that take it in order, by provider and size; `modelFor(task)` at every call site, which never picks a model; a call the first model cannot take goes to the next with the same parameters
- `OUTAGE` fails a provider or a model before the network, so the fallback is rehearsed and visible in the traces; when every model is down the chat says so in one sentence and keeps the message
- `pnpm routes`: the chat, extraction and triage evals on each provider's small and large model, with the cost per case and the p95 latency of a call read back from the traces; a provider without a key is a row that says so
- `docs/routing.md`: the table, the production routing with 2 sentences per row, the fallback chain and what the person sees at each step

### WB-52 Evals as the development loop: 30 cases a task, a calibrated judge, the gate in CI, the scoreboard

- One suite over the 3 tasks (`src/lib/eval-suite.ts`): the chat's golden cases, the triage cases and the documents, at least 30 each, from hand-written cases, what people sent, and candidates `pnpm eval:generate` writes for a person to review; every case says its source and whether every pull request runs it; an action is checked by the tool it must call
- Programmatic checks before the judge (a forbidden phrase, a tool not called, the wrong document kind); the judge on the large model, never the one under test, calibrated by `pnpm eval:calibrate` against 20 replies a person scored
- `pnpm eval --gate`: a hard failure or a mean under 0.7 fails, a mean below the last recorded run by more than the detectable change warns; `.github/workflows/eval.yml` runs the smoke subset on every pull request that touches a prompt, a tool, a model or an eval and posts the report, and the full suite nightly onto the scoreboard; the fleet's queue runs the same gate
- `/admin/evals`: every recorded run with its margin, the day's fallbacks, the Day 23 framework comparison read from its document, the fleet's numbers; `docs/evals.md` is the loop written down

### WB-53 Audited against the principles; the customer in configuration; one agent where the eval allows

- `docs/architecture.md`: the system drawn as it is, a row per principle with what it costs today, the 4 questions answered, the 2 migrations with before and after; `brain/architecture/principles.md` and D15 carry the principles into Weeks 7 and 8
- `content/customer.json` and `src/lib/customer.ts`: the company, its teams and what each files, the filing rules and the customer sections as configuration; the prompts, the request model and the filing rules read it; a new customer is a new file (10 files touched became 1)
- `src/lib/investigate.ts`: one agent in place of the analyst and its 2 specialists, after `pnpm compare:agents` scored the designs on the 17 golden answer cases (0.73 at $0.018 and 18 s a question; 0.92 at $0.0016 and 6 s for one agent on the small model); the routing table's research row reads small then large

### WB-54 The ticketing system through its MCP server: the sync, 3 product-level tools, the routes compared

- `src/lib/mcp.ts`: an MCP client over the official SDK, a bearer transport, the tools, a call that returns a tool's text and throws its error; `src/lib/github.ts` points it at GitHub's remote server with the issues toolset
- `src/lib/tickets.ts` and `src/inngest/sync-tickets.ts`: the issues pulled since the newest change, 100 a page, every 15 minutes and on demand, into one ticket shape; `/admin/tickets` shows the copy and pulls now
- 3 tools over the server's 46: `find_ticket` reads the copy; `file_ticket` and `comment_on_ticket` write through the server once per key (`filings`) and take a dry run; nothing closes or deletes
- `docs/integrations.md`: the 3 routes compared on time to a first call, auth per user, schema control, data, what breaks on an expired token; Composio and Nango unmeasured for want of an account, and marked so; D16

### WB-55 One shape for tickets and contacts, 3 sync paths, the rule table, a cache with its freshness

- `src/lib/unified.ts`: tickets from GitHub issues and WorkBot requests, contacts from document senders and ticket logins, each with the provider's record in `raw` and the rules that fired in `applied`; one mapping for an issue listed or delivered
- `src/inngest/sync.ts` and `src/app/api/webhooks/github/`: the pull every 15 minutes, a signed delivery replacing a row now, the nightly full pull that logs what the other paths missed and drops what the system no longer lists; every refresh logged with how far behind the copy was
- `content/rules.json` and `src/lib/rules.ts`: the rule table, applied in order before the model sees a record, every change written on it; a phone in any written form finds its contact
- `src/lib/cache.ts`: page reads cached per tenant, served stale while refreshed, with when they were fetched in the tool's answer; hit rate and age measured; `/admin/tickets` shows the paths, the rules and the cache; `docs/data-layer.md`; D17

### WB-56 Config-first: three levels, the rule language and the model's proposals, the entity generator, the task graph

- `content/customers/<id>.json`, `content/defaults.json`, `src/lib/settings.ts`: the product's defaults, the customer's file chosen by `CUSTOMER`, the environment, with the precedence written once; a second tenant from a file alone; the request model pure, built from the customer's teams on the server
- `content/rules.rules`, `src/lib/rule-language.ts`: the rules in a language of 15 productions, an Ohm grammar, semantics onto the Day 28 engine, a printer that round-trips, 20 tests; `pnpm rule` asks the model for a line, tries it on the copy, and a person approves it into the file
- `content/entities/*.json`, `src/lib/entity-generator.ts`, `pnpm generate`: a description becomes the table, the model, the route with its test, the page with its form; `--check` first in `pnpm check`; vendors and locations from descriptions alone
- `turbo.json`: the check as a task graph over the root and the site, cached by inputs, restored in CI; `docs/config.md`; D18

### WB-57 Security: roles and keys, tenants in the database, tools checked below the model, sealed tokens, injection evals

- `src/lib/auth.ts`, `/sign-in`, `/admin/users`, `pnpm users`: users with a role (viewer, agent, admin), keys shown once and stored as hashes, sessions a key opens and its revocation ends; every employee page, action and route checks the caller, the proxy only turns away a request with no credentials
- `src/lib/schema.ts`, `src/lib/db.ts`: a tenant column and a forced row-level security policy on every table, natural keys widened by tenant, the app connected as `workbot_app`, which owns nothing and bypasses nothing
- `src/lib/tool.ts`: every tool states the role it requires; the chat offers what the caller's role reaches and every tool checks again when it runs; pages show only the controls a role can use
- `src/lib/secrets.ts`, `src/lib/credentials.ts`: integration tokens sealed with AES-256-GCM, a GitHub call made with the signed-in user's own token, revocation and `pnpm users reseal`; `src/lib/redact.ts` and `src/inngest/retention.ts`: personal data and secrets out of traces, retention windows in configuration
- `content/eval/injection.json`, `src/lib/eval-security.ts`: 20 injection attempts through chat, tool results and documents as `pnpm eval --task security`, all failing on 2026-10-25; `docs/security.md`, the note for a customer; D19

### WB-58 Documents and spreadsheets: formats by their bytes, two paths for a PDF, tracked changes, SQL over 50,000 rows

- `src/lib/files.ts`: PDF, Word, Excel and images told apart by their bytes; a PDF's text layer page by page, a scan detected by its letters a page; a Word document's text with tracked changes marked, and Word documents written from runs
- `src/lib/extract.ts`: `route` sends a text PDF as its text and a scan or an image as the file, the path kept on the document and shown on the request; the contract schema, read with its changes accepted and every change listed
- `src/lib/sheets.ts`, `/admin/sheets`: a workbook read into a typed table past its title, merges and formulas, its totals row checked against its rows; a DuckDB of its own per question with no file, network or settings access; one SELECT at a time, 50 rows, 5 s; the answer with every query and its rows; the `analyze` route; sheets kept 30 days
- `pnpm formats`, `content/eval/contracts.json`, `src/lib/eval-formats.ts`: 10 invoices by 3 paths, 10 contracts, 5 questions of a seeded 50,000-row export with answers computed in code; `docs/documents.md`; D20

### WB-59 One agent on 4 channels: conversations on the server, identities linked by a code, Twilio, Slack, a hand-off

- `src/lib/assistant.ts`, `src/lib/history.ts`: one turn for every channel, the web's included; conversations kept on the server with each message's channel, the server's copy the one a turn starts from, 90 days
- `src/lib/channels.ts`: one shape for an inbound message, per-channel writing rules enforced on the reply, a one-time code that links a phone or a Slack account to a person and a conversation, STOP and START, the role of a linked employee
- `src/lib/twilio.ts`, `src/lib/outbound.ts`, `src/inngest/channel-reply.ts`, `/api/webhooks/twilio`: signed webhooks, the reply as workflow steps, an outbox that does not resend what the provider accepted and it recorded, retries on provider failures, status callbacks, WhatsApp's 24-hour window and its template
- `src/lib/bot.ts`, `src/lib/chat-state.ts`, `/api/webhooks/slack`: Slack through the Chat SDK, a thread as a conversation, tool use as a card, the SDK's state in a tenant-separated table
- `hand_off` on every channel, `/admin/channels`, the phone link on the chat page, Slack's in settings; `docs/channels.md`; D21

### WB-60 Execution models: every operation classified, fair jobs with dead letters, events in Postgres, resumable chat, live calls

- `docs/execution.md`: every operation as a request, a stream, a job or a workflow, where it runs and why; serverless's limits for this app
- Jobs on Inngest: concurrency per sender and in all, failures no retry can fix ended at once (`src/inngest/fail-fast.ts`), dead letters with `/admin/jobs` to send them back; the documents API answers 202 and the workflow reads the document; `pnpm load`: 500 documents with a noisy sender, fairness and losses counted, caps of 2 and 5 compared
- `src/lib/events.ts`: `request.created` written with its request, consumers (notifications, analytics) reading from their own positions, versioned readers, a bad event dead-lettered after 3 tries
- `src/lib/resumable.ts`, `/api/chat/[id]/stream`: chat replies kept in parts and resumed after a reload
- `src/lib/realtime.ts`, `pnpm realtime`, `/admin/calls`: WebSockets for live voice calls across instances over Postgres's NOTIFY; the schema applied under an advisory lock; D22

### WB-61 Cloud services: two images, a stack shaped like a cloud, costs at two scales, a recommendation, the deployments written

- `Dockerfile`: the web image from Next's standalone output and the tools image for the realtime server and the operator's commands, both naming the commit they were built from; `compose.yaml`: web, two realtime instances, Postgres with pgvector, Inngest self-hosted and a Playwright server on one private network
- The eval smoke suite and `pnpm load` pass in the tools container against the stack
- `BROWSER_URL` for machines without Chrome; the realtime server pings every 30 s, ends silent sockets and exits on SIGTERM, and both pages reconnect (`src/lib/socket.ts`); `COOKIE_DOMAIN` for a realtime server on its own host; `DATABASE_URL_UNPOOLED` preferred where a platform sets both
- `docs/hosting.md`: the services across a neo-cloud, AWS, Google Cloud and Azure, monthly costs at 1,000 and 100,000 users with the 3 assumptions, and the recommendation for Fieldstone Supply; `docs/deploy.md`: Vercel, Supabase, Inngest Cloud and Render with a Neon branch per pull request, and Google Cloud, not run; D23

### WB-62 Infrastructure as code: Terraform on three targets, a Helm chart, releases with smoke and rollback, the pipeline

- `infra/gcp` with `infra/modules/cloud-run-service`: Cloud SQL on a private address, secrets kept out of the state, the registry, both services, one host behind a load balancer, the release jobs; staging and production planned in `terraform test` against a mocked provider
- `infra/kubernetes` and `infra/chart`: the Gateway API, Traefik, KEDA and the secrets; every service from one template, scaling on the queue's depth, a migration hook, the smoke suite as `helm test`; applied to a local cluster, recreated from nothing and timed
- `infra/release.sh` and `infra/gcp/release.sh`: migrate, smoke, move traffic, roll back; `infra/azure`: a VM with a hardened systemd unit behind a load balancer, keys from Key Vault
- `.github/workflows/infra.yml` and `release.yml`: checks and mocked plans on every pull request, apply after approval and release by tag once an account is connected; `docs/infrastructure.md`; D24

### WB-63 Isolation and scale: tiers, egress allowlist, KMS keys, the single tenant, four bottlenecks, runbooks, the questionnaire

- `infra/egress`: every outbound call through Squid with an allowlist and a log; KMS key per environment under Cloud SQL and Secret Manager, data-access logs (`infra/gcp`)
- The single tenant: `infra/gcp/harbor-dental.tfvars`; on a cluster, a namespace per tenant with its own database and a network policy, deployed for Harbor Dental
- `pnpm bench` to the first bottleneck, four rounds: the list bounded, CPU scaling, an index and the schema once per version
- `docs/isolation.md` with three runbooks and a provider-outage game day; `docs/questionnaire.md`; D25

### WB-64 Ship to a customer: the release checklist, a review pack, five usability sessions, the top findings shipped

- `docs/release-checklist.md` against the last full deployment; an uptime check and a budget in `infra/gcp`
- `docs/review.md`: the architecture and the data's path on one page for a customer's reviewers
- `docs/research.md`: the plan, consent text and five tasks; five sessions by role, findings with counts, quotes and severity, each change marked docs, configuration or code
- Shipped: the ordered sequence from an empty project, the missing-document path with dates and names in the admin pages, the questionnaire's tense, the cost box, the spend runbook; D26

### WB-65 Growth: the site for answer engines, citations measured weekly, a scored target list, compliant outreach

- `site/`: five question pages, structured data, author and date, robots, sitemap, `llms.txt`, from `site/src/site.ts`; `pnpm check:aeo`
- `pnpm aeo` and the Monday job `aeo-watch`, results in `citations`; the baseline run
- `src/lib/accounts.ts` and a 25-account pilot in `content/growth/accounts.json`; `src/lib/outreach.ts` and `/api/unsubscribe`
- `docs/growth.md`; D27

### WB-66 Analytics and research: metrics in SQL with tests, a weekly report, an analyst that shows its SQL, a market dossier

- `content/analytics`: a reproducible dataset, five metrics, data tests; `src/lib/analysis.ts` on the shared DuckDB sandbox
- `pnpm analytics report | test | ask | check`: the report with a summary to review, the tests, a question in words, three known answers matched
- `/research` on the public site: 47 claims from 76 sources with confidence labels, and the dataset
- `docs/analytics.md`; D28

### WB-67 Final release: deployed by the pipeline into the isolated environment, the architecture and its numbers, a recorded demonstration

- The merged commit deployed from a clean cluster into Harbor Dental's namespace by `infra/release.sh`, timed, with the smoke suite passing
- `docs/architecture.md`: deployment and operations, the numbers, what would change next
- A recorded demonstration of the chat, a refused injection, a scanned invoice, a spreadsheet question, the evals and the jobs; D29
