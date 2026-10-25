# Backlog

The Linear workspace for WorkBot, mirrored here so agents can read it by path.
One ticket per small change. The acceptance criteria are what the review
checks. Sizes: S is under an hour, M is a few hours.

| Ticket | Title                                                                                  | Size | Status |
| ------ | -------------------------------------------------------------------------------------- | ---- | ------ |
| WB-1   | Landing page                                                                           | S    | done   |
| WB-2   | Health endpoint                                                                        | S    | done   |
| WB-3   | Deployment settings page                                                               | S    | done   |
| WB-4   | CI on every pull request                                                               | S    | done   |
| WB-5   | Request model with validation                                                          | S    | done   |
| WB-6   | Intake form                                                                            | M    | done   |
| WB-7   | Requests list                                                                          | S    | done   |
| WB-8   | Requests API                                                                           | S    | done   |
| WB-9   | Admin console shell                                                                    | S    | done   |
| WB-10  | Request counts on the admin overview                                                   | S    | done   |
| WB-11  | Settings inside the admin console                                                      | S    | done   |
| WB-12  | Request detail page                                                                    | S    | done   |
| WB-13  | Change a request's status                                                              | S    | done   |
| WB-14  | Filter requests by team and status                                                     | S    | done   |
| WB-15  | Policies as Markdown documents                                                         | M    | done   |
| WB-16  | Public site scaffold                                                                   | S    | done   |
| WB-17  | Postgres persistence for requests                                                      | M    | done   |
| WB-18  | Analytics on the intake funnel                                                         | S    | done   |
| WB-19  | Validation messages from the API in the UI                                             | S    | open   |
| WB-20  | Request detail: comments                                                               | M    | open   |
| WB-21  | Admin assistant in the terminal                                                        | M    | done   |
| WB-22  | Tools for the assistant                                                                | M    | done   |
| WB-23  | Research with citations                                                                | M    | done   |
| WB-24  | Web chat                                                                               | M    | done   |
| WB-25  | Assistant in the admin console                                                         | S    | done   |
| WB-26  | Generated dashboards, forms and timelines                                              | M    | done   |
| WB-27  | Memory of the person across conversations                                              | M    | done   |
| WB-28  | Long conversations within budget                                                       | S    | done   |
| WB-29  | Investigation agent                                                                    | M    | done   |
| WB-30  | Explainer pipeline for customer replies                                                | M    | done   |
| WB-31  | Intake workflow: triage to the queue                                                   | S    | done   |
| WB-32  | Knowledge base of 50 or more documents                                                 | M    | done   |
| WB-33  | Agentic retrieval tools                                                                | M    | done   |
| WB-34  | Scraper for supplier pages                                                             | S    | done   |
| WB-35  | Browser agent for portals with no API                                                  | M    | done   |
| WB-36  | Research analyst: the investigation with specialists, filed on the ticket              | M    | done   |
| WB-37  | Voice intake line                                                                      | M    | done   |
| WB-38  | Recordings read into tickets                                                           | M    | done   |
| WB-39  | Extraction engine                                                                      | M    | done   |
| WB-40  | Document intake                                                                        | S    | done   |
| WB-41  | Document approval workflow                                                             | M    | done   |
| WB-42  | Scheduled check-ins and reminders                                                      | S    | done   |
| WB-43  | Tracing with cost per tenant                                                           | M    | done   |
| WB-44  | Prompts outside the code                                                               | S    | done   |
| WB-45  | Evals and alerting                                                                     | M    | done   |
| WB-46  | Deployment                                                                             | S    | open   |
| WB-47  | The architecture written up, and a design pitched                                      | M    | done   |
| WB-48  | One policy across 3 CLIs, the company brain, the way of working                        | M    | done   |
| WB-49  | A fleet of 50 tasks: the dispatcher, the review fleet, the batched queue               | M    | done   |
| WB-50  | The research agent on 3 frameworks, compared on 5 topics                               | M    | done   |
| WB-51  | Two providers behind one layer, routed per task, with a fallback that keeps WorkBot up | M    | done   |

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
