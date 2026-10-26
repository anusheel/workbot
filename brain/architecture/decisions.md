# Architecture decisions

The decisions behind the system as built, numbered in the order they were made. Each says what was decided, why, what it costs, and what reversing it would take. A reversed decision stays here, marked superseded, with the date.

## D1. One Postgres database, PGlite embedded for development and tests (Day 5)

Vectors, records and operational data in one store; the same SQL everywhere; `DATABASE_URL=memory://` in tests. Costs: a search-heavy product would want a vector store of its own. To reverse: `src/lib/db.ts` is the only module that knows the driver.

## D2. The AI SDK for the web, the provider SDKs for the terminal (Day 6)

One call shape, middleware and structured output for the product; the wire format in view where the course teaches it. Costs: 2 paths to keep in step. To reverse: `src/lib/chat.ts` adapts one to the other.

## D3. Tools are a Zod schema and a function, defined once (Day 7)

`src/lib/tools.ts`; each provider turns them into its own format. Costs: none found. To reverse: nothing to reverse.

## D4. Our own agent loop, 60 lines, with limits (Day 11)

Steps, dollars and seconds bound every run; a scripted model tests it. Costs: no built-in resumability, which Inngest supplies where it matters. To reverse: swap `runAgent` for a framework's loop behind the same `Tool` type.

## D5. The Claude Agent SDK for the explainer pipeline only (Day 12)

Subagents and hooks where they save code; everywhere else the loop is ours. Costs: a second runtime, on the Claude Code sign-in. To reverse: the pipeline is one file.

## D6. Agentic retrieval over a top-k dump (Day 13)

The model explores the knowledge base with `find`, `ls`, `cat`, `grep`, scoped by section. Costs: more calls per answer than one retrieval; `pnpm compare:retrieval` measures it. To reverse: `find` alone is the classic path.

## D7. The browser agent stays within bounds (Day 14)

Every request from the agent's browser passes the start site or the public-address rule. Costs: no intranet browsing from a public start. To reverse: `bounds` is one function.

## D8. Durable workflows on Inngest for documents; plain requests for chat (Day 18)

A reviewer takes a day; a chat turn takes seconds. Costs: a dev server beside the app; a hosted engine in production. To reverse: the steps are functions; the engine is the serve route and the client.

## D9. Tracing and prompts in our own tables, Langfuse named as the hosted path (Day 19)

No account was available; the records are the same and no content is stored. Costs: no sessions, scores or prompt UI beyond ours. To reverse: `withTrace`/`traced` and `promptOf` are the seams.

## D10. Small model first (Days 6 to 19)

Haiku reads, extracts, judges and runs specialists; Sonnet decides and writes; Opus never by default. Costs: quality on hard documents, caught by the confidence threshold and the reviewer. To reverse: the routing table (D13) is the only place sizes are chosen. Superseded in part on 2026-10-25 by D13: the chat moved to the small model, because the table could not tell the 2 apart; and by D15: the investigation too, because one agent on the small model scored 0.92 against the analyst's 0.73.

## D11. One policy for 3 CLIs, instruction files per package (Day 21)

`AGENTS.md` is the source, `CLAUDE.md` imports it; MCP servers declared per CLI from one list; skills shared as commands. Costs: 3 config files to keep in step, which a test checks. To reverse: delete 2 of them.

## D12. The loop stays; LangGraph.js for the first resumable agent, the Claude Agent SDK where Claude Code parity matters (Day 23)

The same research agent on 3 frameworks, 5 topics each (`docs/frameworks.md`): the product keeps its own 90-line loop; the explainer stays on the Claude Agent SDK; LangGraph.js is the choice for an agent that must pause for a person and resume, because its checkpoints live in the Postgres we have and its graph is testable with a scripted model and drawable. The OpenAI Agents SDK is a pattern to copy, not a dependency: we run Anthropic models and the adapter for them is beta. Costs: 3 framework packages in the tree for the comparison. To reverse: `src/lib/frameworks/` is the only place they are imported.

## D13. One routing table per task, the other size behind each; one provider until the second is measured (Day 24)

Every model call names its task; `src/lib/routing.ts` maps it to its models in order, and a call the first cannot take (5xx, 429, unreachable) goes to the next with the same parameters. The rows come from `pnpm routes` (`docs/routing.md`): the small model answers chat (0.83 against 0.87 under one judge, 0.91 against 0.88 under the other, at a twentieth of the price), reads, extracts, triages and judges; the large model lays out pages and writes reports until those have an eval (the research row superseded by D15 on 2026-10-25: one agent on the small model). OpenAI is in the layer and in no route: no key, so no column, so no row. Costs: an outage of the whole provider is still an outage, said in one sentence; a failed first call at each step of a turn, until a circuit breaker remembers. To reverse: the table is one object, and a third entry per row adds the provider.

## D14. Evals are the development loop: a gate in CI and in the queue, a scoreboard, a judge that is never the model under test (Day 25)

A change to a prompt, a model or a tool is run against the suite and compared to the last recorded run before it ships. Every case says where it came from (hand, what people sent, generated and reviewed) and whether every pull request runs it; a case is never edited to make a prompt pass. The chat's judge is the large model (`judge: anthropic/large`, which supersedes D13's row) because the chat runs on the small one, and it agreed with a person on 20 of 20 labeled replies. A hard failure or a mean under 0.7 blocks; a drop larger than the detectable change against the last run warns; nothing gates on one run. Costs: a smoke run on every pull request that touches a prompt, a tool, a model or an eval (about $0.15), the full suite nightly (about $1.50), and a person's hour a week on the judge's disagreements. To reverse: delete the workflow; the sets and the CLI stay.

## D15. The principles of Day 26, and the 2 migrations they asked for: the customer as configuration, one agent for the investigation (Day 26)

The code is audited against the unlearning list (`docs/architecture.md`) and held to the principles in `principles.md`: one deployable and the static site, Postgres with JSONB for what the model shapes, tools over retrieval, thin routes and plain functions, one agent unless an eval shows a second helps, configuration for what varies by customer, route or version, boring technology, and the 4 questions of a review. The 2 largest costs in the audit were migrated: the customer, which 10 source files named, is `content/customer.json`; the research analyst's 2 specialists, measured on the 17 golden answer cases at 0.73 for $0.018 a question against one agent's 0.92 for $0.0016 on the small model, went, and the research route reads small first. Kept with their cost named: the site as a second deployable (12 configuration files for 140 lines), typed columns for requests (a field touches 10 files), recordings as bytes in Postgres. Costs: team ids are strings now, validated against the file; the explainer's 3 subagents are unmeasured and next. To reverse: inline the file's values; the specialists are in the history at `1d73227`.

## D16. The ticketing system through the vendor's MCP server, the sync in-house, 3 tools over 46 (Day 27)

Of the 3 routes to a customer's systems, WorkBot takes the vendor's MCP server where one exists: GitHub's keeps the tool surface and the auth, the client is under 60 lines (`src/lib/mcp.ts`), and a token to a first call took under an hour. What a platform sells besides, WorkBot does in-house where the piece is small: the sync is one function that pulls since the newest change into one table every 15 minutes, so the model reads a copy, never the network, and a token that expires fails a sync run, not a question. The model never sees the vendor's tools; it gets 3 of ours, a find over the copy and 2 writes made once per key with a dry run, and nothing that closes or deletes. Composio and Nango were not measured: both need an account, none was available, and their columns in `docs/integrations.md` say so. Costs: one more table and a cron; the token is the app's, so every filing is WorkBot's, not its author's. To reverse: unset `GITHUB_TOKEN`; the tools and the sync are off.

## D17. One table per concept with the provider's record in raw, rules as data before the model, a copy refreshed by pull, push and a nightly read of everything (Day 28)

A ticket and a contact each have one shape and one table, whatever system they came from, with a `source` column, the provider's record whole in `raw`, and the rules that fired in `applied`; a new provider is a new mapping function, not a new table. Anything with a right answer is a rule in `content/rules.json`, applied in order before the model sees the record and written on it, so the model reasons over clean data and a reviewer can see what was done to it. The copy is kept by 3 paths that are each measured: the 15-minute pull, a signed webhook delivery that replaces a row within seconds, and a nightly full read that logs every row the other two missed and drops what the system dropped. Reads from the web are cached per tenant with the fetch time carried to the model. Costs: 5 tables and a cron more; a public address is needed before GitHub delivers anything, and nothing alerts when the copy stays stale. To reverse: the mappings go, the Day 27 table comes back; the rules file is read by one module.

## D18. Configuration in three levels met in one function, rules as a language, entities from descriptions, a task graph before a monorepo (Day 29)

What varies by deployment is configuration parsed at startup: the product's defaults, the customer's file that `CUSTOMER` names, the environment, with the precedence in `src/lib/settings.ts` and nowhere else, so a second tenant is a second file. Rules are written in a language with a grammar rather than JSON, because a person reads a line in a diff and the model can be asked for one, and one parser gates both; the engine that applies them did not change. An entity is a description that `pnpm generate` turns into its table, model, route, test and page, and the check fails when a generated file drifts from its description, so generated code is never edited by hand. The check runs as a Turborepo task graph over the 2 workspace packages, cached by inputs. The `apps` and `packages` layout is deferred with its trigger written down: a second app, or a second consumer of a package; until then one deployable holds (D15) and a package with one consumer is a layer. Costs: a dependency on Ohm and on Turborepo; a customer's client components take their teams as props rather than import them. To reverse: a customer file inlined, the table back in code, the generated files kept as code, `pnpm check` as a shell chain again.

## D19. Capabilities below the model: roles checked at every layer, tenants separated by the database, secrets never stored in the clear (Day 30)

What the assistant may do is code, not instruction. A caller is a user with a role, signed in with a key stored as its hash; every page, action, route and tool checks the role where the work happens, and the chat offers only the tools the role reaches, so an instruction planted in a ticket or a page can change what the assistant says, not what it does. Tenants are separated by forced row-level security on every table and an app role that owns nothing, so a query that forgets a filter still sees only its customer's rows; this guards against the app, not against holders of the database credentials, and a customer who needs that gets its own database. Integration tokens are sealed under a key from the environment and the trace keeps no prompt, no reply and no unredacted error. 20 injection attempts run as an eval in CI. Costs: a check at each layer, a key to issue for every person and service, a sealing key to rotate. To reverse: drop the policies and the role, and the checks still stand alone.

## D20. Each format by its own path: a PDF's text unless it is a scan, a contract's changes kept in the text, a spreadsheet through SQL (Day 31)

A file is what its bytes say. A PDF with a text layer reaches the model as its text and a scan as the file; on 10 invoices both paths read the fields alike, and the text cost a third less, with the gap growing by about 1,600 input tokens a page. The text loses layout, which cost one field in 10, so a document whose meaning is its layout should go as the file. A Word document goes as its text with tracked changes marked, the record read with the changes accepted and every change listed. A spreadsheet never enters a prompt: it loads into an in-memory DuckDB with no file, network or settings access, and the model answers by SELECTs that come back with the answer; the small model answered 5 of 5 questions of a 50,000-row export at a twentieth of the large one's cost. Costs: a router to keep, a sandbox rebuilt for each question, measurements on documents written for the test. To reverse: send every file natively and drop the router; sheets have no path without the sandbox.

## D21. One agent behind channel adapters, conversations on the server, people linked by a code they send (Day 32)

Every channel hands the same agent one shape of message and gets a reply fitted to its limits; the turn is the web chat's, so a prompt or a tool changes once for all of them. Conversations moved from the browser to Postgres, because a conversation that continues on a phone has to live where the phone can reach it. Two identities become one person only when a code shown in one is sent from the other; no matching by name or number. SMS and WhatsApp go through Twilio's REST API directly, a few lines with no SDK, behind a workflow and an outbox that does not resend a message whose provider id it holds; Slack goes through the Chat SDK, with its state in a table of ours so the tenant policies cover it. Customers on SMS and WhatsApp are told they are customers; the signed-out web visitor is not, because the chat eval showed the web assistant is defined for employees. Costs: a store of conversations to keep and expire, a workflow per text message, the providers' accounts and their rules. To reverse: the adapters are the only channel code; dropping one leaves the others whole.

## D22. Four kinds of work, each where it belongs: one queue engine, events in Postgres, a container only for sockets (Day 33)

Every operation is a request, a stream, a job or a workflow, written down in `docs/execution.md`. Jobs and workflows share Inngest, already running, rather than adding a second engine: each function caps its runs per sender and in all, retries with backoff, ends at once on a failure no retry can fix, and dead-letters the rest for a person. The cap is 2 of 10 per sender, measured against 5: people uploading a few documents wait under 100 s behind a 300-document flood, at the price of idle slots while the flood drains. Domain events are rows written with the change they describe, read by each consumer from its own position, at least once; a consumer whose effect must not repeat is idempotent by the event id. Chat replies resume from parts kept in Postgres rather than Redis. WebSockets run on a separate realtime server, since a function's connection closes at its maximum duration and a call can outlast it, with Postgres's NOTIFY as the backplane between instances. Costs: a container to deploy, polling for resumed replies, minute-scale event delivery, a cap that leaves capacity idle. To reverse: each piece stands alone; drop the realtime server and calls are simply not followed live.

## D23. Two images and a database, any cloud; the neo-cloud for Fieldstone, the customer's cloud when a regulator asks (Day 34)

WorkBot ships as two images from one Dockerfile, the web tier from Next's standalone output and a tools image for the realtime server and the operator's commands, plus Postgres with pgvector by a direct connection; `compose.yaml` runs them as a major cloud would, and the eval smoke suite and the load test pass against it. Nothing in the code names a cloud: the browser is a Playwright server when `BROWSER_URL` is set, the job engine an address when `INNGEST_BASE_URL` is, the session cookie a parent domain when the realtime server has a host of its own. Priced at 1,000 and 100,000 monthly users, the platform is 90% of the bill at the first and the model 75 to 80% at the second, where the neo-cloud, Google Cloud and AWS are within 7%. Fieldstone gets the neo-cloud, since nobody there runs a network and the move to a major cloud is a runbook; a customer under HIPAA or an enterprise landing zone gets its own cloud, where one agreement covers the services. The deployments are written in `docs/deploy.md` and not run: they create billed resources in someone's account. Costs: a container image of 3.2 GB for the tools, a browser service to run, a domain per customer for the app and its realtime server. To reverse: the images are the only deployment code; a platform that builds from source needs neither.

## D24. Terraform for the infrastructure, Helm and a script for releases, three targets from the same images (Day 35)

The infrastructure is Terraform, one root per target and one state per environment: Google Cloud (Cloud Run, Cloud SQL, Secret Manager, a load balancer serving both services on one host), a Kubernetes cluster's platform (the Gateway API with Traefik, KEDA, the secrets), and an Azure VM whose systemd unit runs the web image read-only. State is remote and locked; no secret reaches it, since generated passwords are ephemeral and go in through write-only arguments, and the API keys are added by an operator to secrets Terraform made empty. Releases are not applies: Terraform makes each service once and leaves the image to the release, `infra/release.sh` on a cluster (migrate, wait, smoke, roll back) and `infra/gcp/release.sh` on Cloud Run (migrate and smoke as jobs, then traffic, back on failure). The cluster path ran for real on a local cluster, scaling on the queue's depth, rolling back a broken tag and recreated from nothing; the cloud roots are planned in tests against mocked providers, since applying them bills an account. Costs: a chart and two release scripts to keep beside the Terraform, Postgres in the cluster for a cluster that stands alone. To reverse: each root stands alone, and the images run without any of it.

## D25. Isolation by layer, one way out, keys in KMS, the single tenant as a variable (Day 36)

Three network tiers with no public database; every outbound call through an egress proxy with an allowlist and a log, because an agent that can fetch any page is the easiest path out for a customer's data. A KMS key per environment under the database and the secrets, rotated by the cloud, with reads of either logged. A customer who must be kept apart gets the same code with one variable: its own project on Google Cloud, its own namespace, database and network policy on a cluster. Load tests to the first bottleneck found an unbounded list, a scaler blind to CPU, and new replicas re-running the schema's DDL under traffic; the schema now runs once per version. Costs: a proxy to run and an allowlist to keep, a stack per isolated tenant, a page the agent cannot read until someone allows it. To reverse: unset the proxy and the variable; the rest is configuration.

## D26. What a customer receives is tested by someone who did not write it (Day 37)

The runbook, the admin pages, the incident runbooks, the security documents and the cost estimate were each given to a participant in one role with one task and nothing else: a platform engineer, an operations lead, a security reviewer, an on-call engineer and a finance manager. This round's participants were agents, which tests whether the documents can be followed, not what people need; the plan and consent text are written for the customer's own people. The three most severe findings shipped the same day (an ordered deployment sequence, a path for a missing document with dates and names on the pages, and documents that say which controls run and which are only written), and the rest went to the backlog marked as configuration or code. Costs: a study per release that changes what a customer touches. To reverse: nothing to undo; the documents are better either way.

## D27. Found by answer engines, measured by citations; outreach that cannot break its own rules (Day 38)

The public site is built from one file of buyer questions: pages, structured data, the sitemap and `llms.txt` all come from it, and `pnpm check:aeo` fails the build on a regression. Whether assistants cite it is measured weekly by asking them, not guessed; the first run found the name shared with other products, which changes what the pages say first. The target profile is code that scores evidence and ignores what is unknown. The outreach sequence carries the sender, an address and a signed one-click unsubscribe in every message, stops at a reply, and checks a suppression list before any send; nothing is sent until the domain's SPF, DKIM and DMARC are in place. Costs: a weekly bill for the questions and searches, a list to keep current. To reverse: the site and the code stand apart from the product.

## D28. Metrics as SQL files with tests, in a locked DuckDB; an analyst that shows its SQL (Day 39)

At this size the analytics are a dataset, five metric definitions in SQL and data tests that must return no rows, run in the same locked DuckDB the spreadsheets use. ClickHouse, Metabase and Hex are where the definitions go when the volume asks, not before. The analyst agent answers from those definitions with one read-only SELECT at a time, row, time, step and dollar limits, and every query returned with its answer; three questions with answers known from hand-written SQL check it. Costs: synthetic data until a deployment's copy loads, and a report a person must read. To reverse: the SQL files move to any warehouse as written.
