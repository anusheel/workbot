# Fleet tasks

Fifty tasks for a fleet of coding agents, filed as issues with `node scripts/fleet.mjs file docs/fleet-tasks.md`. Each is small enough for one agent in one session, independent of the others (no two touch the same file), and verifiable: the test it names is written before the change and fails until the change lands. A task has a goal, acceptance criteria an agent can check one by one, constraints (what must not change), the files involved, and the test to write first. What an agent did with each is on its pull request; what the shapes taught is in `docs/fleet.md`.

## F-01 Investigate: refuse private addresses in browse_site

### Goal

`read_url` and the page-text fallback refuse loopback, private and link-local addresses; `browse_site` in `src/lib/investigate.ts` starts the browser on any URL the model picks, so a ticket that names a cloud metadata address gets it screenshotted into the findings.

### Acceptance criteria

- [ ] A `browse_site` call on a loopback, private or link-local URL returns a failed tool result that says "not a public web address", through `isPublic` from `src/lib/web.ts`.
- [ ] The browser factory is not called and nothing is fetched for such a URL.
- [ ] Public URLs behave as before.

### Constraints

Only `src/lib/investigate.ts` and its test change. No new dependency.

### Related code and docs

`src/lib/investigate.ts` (the `browse_site` tool), `src/lib/web.ts` (`isPublic`), `src/lib/browser-agent.ts` (`bounds`).

### Test

`src/lib/investigate.test.ts`: script the web specialist to call `browse_site` on `http://169.254.169.254/latest/meta-data` with a spy passed as the `browser` option; the spy is never called and the logged entry has `failed: true`.

## F-02 Web: a private name with a trailing dot is still private

### Goal

`isPublic` in `src/lib/web.ts` checks host names against a private-name pattern, but a URL's host keeps a trailing dot after parsing, so `http://localhost./` and `http://db.internal./` pass as public and reach `readPage`, redirects, the documents URL check and the browser bounds.

### Acceptance criteria

- [ ] `isPublic` is false for `http://localhost./` and `http://db.internal./`.
- [ ] A redirect to `http://localhost./` is refused by `readPage`.
- [ ] Every URL the existing tests accept is still accepted.

### Constraints

Only `src/lib/web.ts` and its test change.

### Related code and docs

`src/lib/web.ts` (`isPublic`, the private-name pattern), `src/lib/web.test.ts`.

### Test

`src/lib/web.test.ts`: add both URLs to the loop in the test that refuses private addresses, and one redirect case.

## F-03 Context: the message being answered is always kept

### Goal

`fitContext` in `src/lib/context.ts` keeps the first message and then as many recent ones as fit. When the first message alone is over budget, or the newest does not fit in what is left, the newest message is dropped and the model never sees the question.

### Acceptance criteria

- [ ] The last message is always in `kept`.
- [ ] When the first and the last cannot both fit, the last wins and the first goes to `dropped`.
- [ ] `kept` and `dropped` together hold every message exactly once, in order.

### Constraints

Only `src/lib/context.ts` and its test change; the budget rule for the middle messages stays.

### Related code and docs

`src/lib/context.ts` (`fitContext`), `src/app/api/chat/route.ts` (reads the question from the last kept message).

### Test

`src/lib/context.test.ts`: an oversized first message, a small middle one and a small last one; `kept` ends with the last message's id and `dropped` holds the first.

## F-04 Providers: a cut-off OpenAI response runs no tool

### Goal

In `src/lib/providers.ts` the OpenAI loop treats `response.incomplete` like `response.completed`, so a function call cut off at the token limit is run, and parsing its partial arguments throws. The Anthropic branch already refuses truncated calls.

### Acceptance criteria

- [ ] An incomplete response holding a function call resolves with its usage and runs no tool.
- [ ] Function-call arguments that are not valid JSON go back to the model as a failed tool output instead of throwing.
- [ ] Completed responses behave as before; every existing providers test passes.

### Constraints

Only `src/lib/providers.ts` and its test change.

### Related code and docs

`src/lib/providers.ts` (the OpenAI branch and its argument parsing; compare the Anthropic branch's handling of truncated calls).

### Test

`src/lib/providers.test.ts`: with the `capture()` helper, a `response.incomplete` event whose output holds a function call with arguments `{"expression": "2 +`; the call resolves, the tool spy is never called, one request is made.

## F-05 Knowledge tools: grep rejects patterns that can hang the server

### Goal

The `grep` tool in `src/lib/knowledge-tools.ts` is reachable from the public web chat and compiles any pattern it is given. A pattern with a nested repeat, such as `^(\w+)*$`, takes seconds on a 30-character line and longer with each character; an invalid pattern throws.

### Acceptance criteria

- [ ] A pattern longer than 100 characters, or with a quantified group that itself contains a quantifier, is rejected with a message the model can act on.
- [ ] An invalid regular expression is searched as plain text.
- [ ] `net 30` and `\$200` still match as before.

### Constraints

Only `src/lib/knowledge-tools.ts` and its test change. No regex library.

### Related code and docs

`src/lib/knowledge-tools.ts` (the grep tool's input schema and run), `src/lib/knowledge.ts` (where the pattern is compiled).

### Test

`src/lib/knowledge-tools.test.ts`: `^(\w+)*$` is rejected within a second; `(` resolves with plain-text results.

## F-06 Research: use every search result, survive a failed search

### Goal

`research` in `src/lib/research.ts` asks for 3 search results and uses only the first, skips the query when that URL is already a source, and lets a failed search end the run while a failed page read is tolerated.

### Acceptance criteria

- [ ] Each query adds the first result whose URL is not already a source.
- [ ] A search that throws is reported through `on.step` and skipped; the run still answers from the other sources.

### Constraints

Only `src/lib/research.ts` and its test change.

### Related code and docs

`src/lib/research.ts`, `src/lib/research.test.ts` (which stubs `fetch`; the Brave key is set with `vi.stubEnv` and `vi.resetModules`).

### Test

`src/lib/research.test.ts`: two queries whose top result is the same URL yield 2 distinct sources; a 429 on one query still produces an answer and a step that names the failure.

## F-07 Scrape: pagination stops on loops and non-http links

### Goal

`scrape` in `src/lib/scrape.ts` follows a "next" link by its text. A `#` link re-reads the same page and duplicates its items; a `javascript:` link makes the fetch throw and loses every page already read; "More about us" counts as a next link even when the page has a `rel=next` link.

### Acceptance criteria

- [ ] A link that is not http(s), or that points (ignoring the fragment) to a page already read, ends pagination and returns what was read.
- [ ] A `rel=next` link wins over a text match.
- [ ] "More", "Next" and "Next page" still match; "More about us" does not.

### Constraints

Only `src/lib/scrape.ts` and its test change.

### Related code and docs

`src/lib/scrape.ts` (the next-link rule and the page loop), `src/lib/scrape.test.ts`.

### Test

`src/lib/scrape.test.ts`: page 2 links "next" back to page 1 with `pages: 5`; fetch is called twice and no item is duplicated.

## F-08 Video: a recording with no duration header does not become NaN

### Goal

`duration` in `src/lib/video.ts` parses ffprobe's output with `Number`. ffprobe prints `N/A` for files without a duration header, which is common for browser-recorded webm, so saving the recording fails on the integer column after the frames were already described and paid for.

### Acceptance criteria

- [ ] Parsing never returns NaN: `N/A` falls back to a value computed from the frames and the interval, or throws an error that names the file.
- [ ] `12.48\n` still parses to 12.48.

### Constraints

Only `src/lib/video.ts` and its test change.

### Related code and docs

`src/lib/video.ts` (`duration`), `src/app/requests/actions.ts` (the caller that stores it).

### Test

`src/lib/video.test.ts`: export a `parseDuration` helper; `parseDuration("N/A\n")` is not NaN and `parseDuration("12.48\n")` is 12.48.

## F-09 Embeddings: Voyage errors keep their reason and a short response is caught

### Goal

`embed` in `src/lib/embeddings.ts` throws "Voyage answered 400" without the response body, and trusts the response shape: fewer vectors than inputs crashes indexing with a TypeError far from the cause.

### Acceptance criteria

- [ ] A non-OK response throws with Voyage's `detail`, truncated to a line.
- [ ] A response without a `data` array, or with a vector count that differs from the input count, throws an error that says so with both counts.

### Constraints

Only `src/lib/embeddings.ts` and its test change.

### Related code and docs

`src/lib/embeddings.ts`, `src/lib/embeddings.test.ts` (which already stubs `fetch` and the key).

### Test

`src/lib/embeddings.test.ts`: a 400 with `{"detail":"input too long"}` rejects with that text; 2 inputs with 1 vector back rejects and mentions 2 and 1.

## F-10 Tracing: a cancelled or failed stream still writes its trace

### Goal

The streaming path in `src/lib/tracing.ts` writes the trace in `flush`, which runs only when the stream ends normally. A client that disconnects mid-reply, or a stream that errors, leaves no trace, so that spend and those failures are missing from the traces page and the hourly watch.

### Acceptance criteria

- [ ] Cancelling after the first chunk writes exactly one trace with `ok = false`.
- [ ] A stream error writes exactly one trace with the error message.
- [ ] A normal stream still writes exactly one trace.

### Constraints

Only `src/lib/tracing.ts` and its test change.

### Related code and docs

`src/lib/tracing.ts` (`traced`, the stream wrapper), `src/lib/tracing.test.ts`.

### Test

`src/lib/tracing.test.ts`: call `traced(model).doStream()` directly, read one chunk, cancel the reader, and expect one trace row with `ok = false`.

## F-11 Database: both drivers send null for undefined

### Goal

In `src/lib/db.ts` the embedded driver used by every test stores an undefined parameter as null, while the Postgres driver used in production throws. A caller that forgets `?? null` passes the tests and fails in production.

### Acceptance criteria

- [ ] Both connections send null for an undefined parameter, through the driver's transform option or the `query` wrapper.
- [ ] A test proves the Postgres branch receives null.

### Constraints

Only `src/lib/db.ts` and a new test change; the query API stays the same.

### Related code and docs

`src/lib/db.ts` (`connect`, the two branches).

### Test

New `src/lib/db.test.ts`: mock the `postgres` module with `vi.mock` and check that `connect("postgres://x").query("select $1", [undefined])` passes null through; with the embedded driver, `query("select $1::text as v", [undefined])` returns null.

## F-12 Knowledge: two first searches share one indexing run

### Goal

`find` in `src/lib/knowledge.ts` indexes the knowledge base on first use when the chunk table is empty. Two concurrent first calls both see an empty table and interleave their deletes and inserts, and one fails on the primary key. `src/lib/prompts.ts` guards the same race for its seed.

### Acceptance criteria

- [ ] Concurrent first-use calls share one in-flight indexing run and both resolve.
- [ ] The table ends with each chunk exactly once.

### Constraints

Only `src/lib/knowledge.ts` and its test change.

### Related code and docs

`src/lib/knowledge.ts` (the row-count check and the index routine), `src/lib/prompts.ts` (the seed guard).

### Test

`src/lib/knowledge.test.ts`: delete all chunks, then `Promise.all([find("refund"), find("refund")])` resolves and the row count equals the chunk count.

## F-13 Documents: a filed request fits the request model's limits

### Goal

`toRequest` in `src/lib/documents.ts` puts raw subjects, vendor names and every invoice line into the request, which the request model then rejects: a title over 120 characters or empty, or a body over 5,000 characters, throws after both model calls were paid for.

### Acceptance criteria

- [ ] Titles are cut to 120 characters with an ellipsis; an empty subject falls back the same way a missing one does.
- [ ] Bodies are cut to 5,000 characters with a note of how many lines were left out.
- [ ] The limits come from `src/lib/request-model.ts`, not copies.

### Constraints

Only `src/lib/documents.ts` and its test change.

### Related code and docs

`src/lib/documents.ts` (`toRequest`), `src/lib/request-model.ts` (the limits).

### Test

`src/lib/documents.test.ts`: an email with a 200-character subject and an invoice with 500 lines both convert without throwing, within the limits.

## F-14 Prompts: setShares takes only whole percentages of real versions

### Goal

`setShares` in `src/lib/prompts.ts` checks that the shares total 100 and nothing else: `{1: 150, 2: -50}` passes, and `{9: 100}` sets every real version to 0, after which `promptOf` serves the newest version to everyone.

### Acceptance criteria

- [ ] Each share is a whole number from 0 to 100 and each version exists; otherwise `setShares` throws naming the version or the share.
- [ ] A rejected call leaves the shares unchanged.

### Constraints

Only `src/lib/prompts.ts` and its test change.

### Related code and docs

`src/lib/prompts.ts` (`setShares`, `promptOf`), `src/lib/prompts.test.ts`.

### Test

`src/lib/prompts.test.ts`: both bad calls reject, and `promptOf` still returns the version that had traffic.

## F-15 Memory: the prompt carries the newest memories, not all of them

### Goal

Up to 3 memories are stored per reply with no cap, and `memoryNote` and `extractMemories` in `src/lib/memory.ts` put every stored memory into the system prompt and the extractor's "already known" list on every turn.

### Acceptance criteria

- [ ] `memoryNote` and `extractMemories` use at most the newest 30 memories.
- [ ] `listMemories` without a limit still returns everything, for the settings page.

### Constraints

Only `src/lib/memory.ts` and its test change.

### Related code and docs

`src/lib/memory.ts`, `src/lib/memory.test.ts`.

### Test

`src/lib/memory.test.ts`: with 40 memories stored, `memoryNote` has 30 lines, newest first.

## F-16 Requests: updateRequest answers a bad id without a query

### Goal

`getRequest` in `src/lib/requests.ts` guards against ids that are not UUIDs; `updateRequest` does not, so a forged id from the status-change action reaches Postgres as an invalid UUID and becomes a 500, and an unknown id succeeds silently while the action still records a status-change event.

### Acceptance criteria

- [ ] `updateRequest` returns the updated request, or undefined, without throwing, when the id is not a UUID (running no query) or does not exist.
- [ ] The status-change action records no event when `updateRequest` returned undefined.

### Constraints

`src/lib/requests.ts`, `src/app/requests/actions.ts` and the requests test change; nothing else.

### Related code and docs

`src/lib/requests.ts` (`getRequest`, `updateRequest`), `src/app/requests/actions.ts` (the status change).

### Test

`src/lib/requests.test.ts`: `"nope"` and a random UUID both give undefined; an existing id comes back with status `done`.

## F-17 Config: a malformed daily budget does not turn the alert off

### Goal

`src/lib/config.ts` reads `ALERT_DAILY_DOLLARS` with `Number(value || 5)`; a non-numeric value becomes NaN, and `spend > NaN` in the hourly watch is never true, so the budget alert never fires.

### Acceptance criteria

- [ ] A non-numeric or non-positive value falls back to 5 with a warning on startup.
- [ ] `12.5` gives 12.5.

### Constraints

Only `src/lib/config.ts` and a new test change.

### Related code and docs

`src/lib/config.ts`, `src/inngest/watch.ts` (the comparison), `.env.example`.

### Test

New `src/lib/config.test.ts`: `vi.stubEnv` plus `vi.resetModules` and a dynamic import, as `src/lib/embeddings.test.ts` does; `abc` gives 5 and `12.5` gives 12.5.

## F-18 Voice: an empty final transcript is not a turn

### Goal

The reducer in `src/lib/voice-model.ts` adds a final speech result as a caller turn even when its text is empty, and the voice API requires at least one character, so the next call answers 400 and the call is stuck.

### Acceptance criteria

- [ ] An empty or whitespace-only final result leaves the state `listening` with the turns unchanged.
- [ ] A final result over 2,000 characters is cut to the API's limit.

### Constraints

Only `src/lib/voice-model.ts` and its test change.

### Related code and docs

`src/lib/voice-model.ts`, `src/lib/voice.ts` (the limits), `src/components/voice-line.tsx` (the listener).

### Test

`src/lib/voice-model.test.ts`: `next(listening, { type: "heard", text: "", final: true })` stays `listening` with no new turn.

## F-19 Health: the check answers within 2 seconds

### Goal

`health` in `src/lib/health.ts` runs `select 1` with no timeout, and the Postgres driver waits up to 30 seconds to connect, so `/api/health` hangs instead of answering 503. Neither the degraded branch nor the route is tested.

### Acceptance criteria

- [ ] The check reports the database unreachable within 2 seconds when the query hangs.
- [ ] The route answers 503 when degraded and 200 when ok.

### Constraints

`src/lib/health.ts`, its test and a route test change; nothing else.

### Related code and docs

`src/lib/health.ts`, `src/app/api/health/route.ts`.

### Test

`src/lib/health.test.ts`: mock the database with `vi.doMock` so the query never settles, use fake timers, and expect `degraded` after 2 seconds; `src/app/api/health/route.test.ts`: 503 on degraded, 200 on ok.

## F-20 Documents API: a size limit before any model call

### Goal

`POST /api/documents` reads the whole upload, empty files included, and sends it to the model with no size check; a malformed multipart body throws with nothing catching it. The admin inbox upload has the same gap.

### Acceptance criteria

- [ ] An empty file, or one over 10 MB, answers 400 naming the limit before any model call.
- [ ] A malformed multipart body answers 400.
- [ ] The limit lives next to `mediaTypes` in `src/lib/extract.ts`, and the inbox upload action uses it.

### Constraints

`src/app/api/documents/route.ts`, `src/app/admin/inbox/actions.ts`, `src/lib/extract.ts` and the route test change; nothing else.

### Related code and docs

`src/app/api/documents/route.ts`, `src/app/admin/inbox/actions.ts`, `src/lib/extract.ts` (`mediaTypes`).

### Test

`src/app/api/documents/route.test.ts`: an empty PDF gives 400, a PDF over the limit gives 400 naming it, and a multipart content type with the body `garbage` gives 400, the mocked model never called; the inbox action refuses an oversized file the same way.

## F-21 Generate API: a bound on the page spec

### Goal

`POST /api/generate` caps the prompt at 2,000 characters but not the page spec it edits, so a spec of any size goes into a large-model call on a route with no rate limit.

### Acceptance criteria

- [ ] A spec whose JSON is over 50,000 characters, or with more than 200 elements, answers 400 with a field error, before any model call.
- [ ] A normal edit still streams.

### Constraints

Only `src/app/api/generate/types.ts`, `route.ts` and the route test change.

### Related code and docs

`src/app/api/generate/types.ts` (the body schema), `src/app/api/generate/route.ts`.

### Test

`src/app/api/generate/route.test.ts`: a spec with 5,000 elements gives 400 and the mocked model is never called.

## F-22 Chat API: bounds on the body, and a test for the rate limit

### Goal

The chat body schema in `src/app/api/chat/types.ts` accepts any number of messages and any conversation id, an empty one included, and no test covers the 429 branch.

### Acceptance criteria

- [ ] More than 200 messages, or an empty or over-long id, answers 400 with field errors.
- [ ] A rate-limited caller gets 429 and no model call is made, shown by a test.

### Constraints

Only `src/app/api/chat/types.ts` and the route test change.

### Related code and docs

`src/app/api/chat/types.ts`, `src/app/api/chat/route.ts` (the 429 branch), `src/lib/rate-limit.ts`.

### Test

`src/app/api/chat/route.test.ts`: mock `@/lib/rate-limit` so `allow` returns false once; expect 429 with the model never called; 201 messages give 400.

## F-23 Document approval: corrections are validated before filing

### Goal

In `src/inngest/document-approval.ts` the reviewer's corrections are any key-value data, merged into the extraction, cast to the record type and filed without a check against the schema.

### Acceptance criteria

- [ ] The merged record is checked against `schemas[type]` before filing.
- [ ] When it fails, no request is filed, the inbox row records the bad field, and the step does not retry (a non-retriable error).
- [ ] The existing valid-corrections test still passes.

### Constraints

Only `src/inngest/document-approval.ts` and its test change.

### Related code and docs

`src/inngest/document-approval.ts`, `src/inngest/events.ts` (the event schema), `src/lib/document-model.ts` (`schemas`).

### Test

`src/inngest/document-approval.test.ts`: approve with `data: { total: "twelve" }`; the result is not `stored`, `requestId` is null, the inbox row's review mentions `total`, and the error thrown is a `NonRetriableError`.

## F-24 Database MCP: no binary dumps, the row limit in the query

### Goal

The database MCP server in `src/mcp/database.ts` fetches every row and cuts to 100 afterwards, and `select *` on the inbox table writes each document's raw bytes into the result.

### Acceptance criteria

- [ ] Binary values show as a placeholder such as `<5 bytes>`.
- [ ] The row limit is applied in the database, a trailing semicolon is tolerated, and the result says when it was cut.

### Constraints

Only `src/mcp/database.ts` and its test change.

### Related code and docs

`src/mcp/database.ts`, `src/mcp/database.test.ts`.

### Test

`src/mcp/database.test.ts`: with a 5-byte document stored, describing the inbox table shows `<5 bytes>` in its sample rows; with 150 rows, a query returns 100 and says it was cut, and the SQL sent to the database carries the limit (spy on `query`).

## F-25 Markdown: model text cannot load remote images

### Goal

`src/components/markdown.tsx` customises only code blocks, so an image in a reply or a report renders as an `<img>` the browser fetches at once, which is a known way for a prompt injection to send data out; the public chat reads untrusted pages through `read_url`. Links carry no `rel`.

### Acceptance criteria

- [ ] An image renders as a link or its alt text, never as `<img>`; the knowledge base has no images, so nothing is lost.
- [ ] Links carry `rel="noopener noreferrer nofollow"`.

### Constraints

Only `src/components/markdown.tsx` and its test change.

### Related code and docs

`src/components/markdown.tsx`, `src/lib/web.ts` (`readPage`, the untrusted source).

### Test

`src/components/markdown.test.tsx`: an image line yields no `<img`, and a link has the `rel` attribute.

## F-26 Rate limit: buckets expire

### Goal

`src/lib/rate-limit.ts` keeps a bucket per caller for the life of the process and never removes one, so every new `x-forwarded-for` value adds a bucket that stays.

### Acceptance criteria

- [ ] A bucket is removed once its window has passed, on the next call.
- [ ] The limit still holds within a window.

### Constraints

Only `src/lib/rate-limit.ts` and its test change; no timers left running.

### Related code and docs

`src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`.

### Test

`src/lib/rate-limit.test.ts`: with fake timers, 100 distinct callers then a window later one call leaves one bucket.

## F-27 Eval: no NaN when nothing was scored

### Goal

`stats` in `src/lib/eval.ts` averages an empty list to NaN, which is what `pnpm eval --only <typo>` prints; and an empty `mustNotContain` phrase zeroes every answer because every string contains the empty string.

### Acceptance criteria

- [ ] `stats([])` returns zeros and a count of 0, and the CLI says no case matched.
- [ ] An empty forbidden phrase is ignored, with a schema refinement so it cannot enter the golden file.

### Constraints

`src/lib/eval.ts`, its test and `cli/eval.ts` change; nothing else.

### Related code and docs

`src/lib/eval.ts` (`stats`, the `Golden` schema, the forbidden-phrase check), `cli/eval.ts`.

### Test

`src/lib/eval.test.ts`: `stats([])` has no NaN; a golden case with an empty phrase fails to parse.

## F-28 Catalog: the submit_request action takes the model's enums

### Goal

The dashboard's `submit_request` action in `src/lib/catalog.ts` takes team and priority as free text, while the request model has fixed lists for both, so a generated form can submit values the request model rejects.

### Acceptance criteria

- [ ] The action's schema uses the request model's team and priority enums.
- [ ] A spec with an unknown team fails validation with a message naming the field.

### Constraints

Only `src/lib/catalog.ts` and its test change.

### Related code and docs

`src/lib/catalog.ts`, `src/lib/request-model.ts` (the enums).

### Test

`src/lib/catalog.test.ts`: an action with team `Marketing` is rejected; one with a listed team passes.

## F-29 Conversations: saved chats survive a full storage and bad data

### Goal

`src/lib/conversations.ts` saves with an unguarded `setItem` and never prunes, while each saved page can add 8,000 characters; once storage is full the quota error is thrown inside the chat's effect and the page falls to the error page. Its `parse` also trusts any JSON as the conversation list.

### Acceptance criteria

- [ ] On a quota error, the oldest conversations are dropped until the save fits, and nothing throws.
- [ ] A stored value that is not a list of conversations reads as no conversations.
- [ ] Valid stored conversations load as before.

### Constraints

Only `src/lib/conversations.ts` and its test change.

### Related code and docs

`src/lib/conversations.ts`, `src/components/conversations.tsx` (the caller).

### Test

`src/lib/conversations.test.ts`: with a fake `localStorage` that throws above 2 conversations, saving 5 keeps the newest 2; a stored `{"nope":1}` loads as an empty list.

## F-30 Navigation: the current page is marked and each nav is named

### Goal

No nav marks where the reader is, and the 3 `nav` landmarks are unlabelled, so `/chat` and `/admin/*` each expose 2 identical navigation regions to a screen reader.

### Acceptance criteria

- [ ] A client `NavLink` sets `aria-current="page"` on the link for the current section: `/requests/<id>` marks Requests, `/admin/inbox` marks Inbox and not Overview.
- [ ] The navs are labelled Main, Admin and Conversations.

### Constraints

`src/components/site-header.tsx`, `src/app/admin/layout.tsx`, `src/components/conversation-list.tsx`, the new `src/components/nav-link.tsx` and its test change; nothing else.

### Related code and docs

`src/components/site-header.tsx`, `src/app/admin/layout.tsx`, `src/components/conversation-list.tsx`.

### Test

New `src/components/nav-link.test.tsx`: with the current path mocked to `/admin/inbox`, Inbox is current and an exact-match `/admin` link is not.

## F-31 Sync commands: OpenCode arguments, and a directory it cannot break

### Goal

`scripts/sync-commands.mjs` copies each skill's body into an OpenCode command. Claude Code numbers positional arguments from `$0`; OpenCode from `$1`, with the highest number taking the rest, so `/api-route orders POST` in OpenCode scaffolds the route `POST`. The script also removes the commands directory before it knows it can rebuild it, and reads every entry of `.claude/skills` as a skill directory, so a `.DS_Store` empties the directory and exits 1.

### Acceptance criteria

- [ ] `commandOf` rewrites `$N` to `$N+1` for OpenCode, and `$ARGUMENTS` stays.
- [ ] Only directories with a `SKILL.md` are read; the commands are built in memory and written after every skill parsed.
- [ ] The run-as-main guard compares real paths, so a symlinked checkout still runs the sync.

### Constraints

`scripts/sync-commands.mjs`, its declaration file, a new test and the generated `.opencode/commands/*.md` change; `scripts/agent-config.test.ts` does not.

### Related code and docs

`scripts/sync-commands.mjs`, `scripts/sync-commands.d.ts`, `.claude/skills/api-route/SKILL.md` (uses `$0`), `.opencode/commands/`.

### Test

New `scripts/sync-commands.test.ts`: `commandOf` turns `$0` into `$1` and leaves `$ARGUMENTS`; a skills directory with a stray file still produces every command.

## F-32 Config test: permissions, discovered instruction files, whole server definitions

### Goal

`scripts/agent-config.test.ts` compares MCP server names only, lists the nested `AGENTS.md` files by hand, and checks no permission, so deleting a deny rule, pointing one config's `figma` at another URL, or adding a package without wiring it all pass.

### Acceptance criteria

- [ ] Each of the 3 configurations denies reading `.env.local`, or the test fails naming the file: a `Read(./.env.local)` entry in Claude Code's `permissions.deny`, a `deny` filesystem rule matching `.env.local` in the Codex profile, and a `read` pattern matching `.env.local` whose value is `deny` in OpenCode.
- [ ] The nested `AGENTS.md` files are discovered (for example with `git ls-files`), not listed.
- [ ] The MCP comparison covers each server's URL or command, not only its name.

### Constraints

Only `scripts/agent-config.test.ts` changes; the configurations do not.

### Related code and docs

`scripts/agent-config.test.ts`, `.claude/settings.json`, `.codex/config.toml`, `opencode.jsonc`, `.mcp.json`.

### Test

The file is the test; run `pnpm exec vitest run scripts/agent-config.test.ts` and, once, each mutation by hand to see it fail.

## F-33 One env rule in the 3 CLI configurations

### Goal

The 3 configurations deny different env files: Claude Code `.env.local` and `.env*.local`, Codex `.env`, `.env.local` and `.env.*.local`, OpenCode everything but `.env.example`. Claude Code's allow list also pre-approves `git diff`, and `git diff --no-index /dev/null .env.local` prints the file.

### Acceptance criteria

- [ ] All 3 deny `.env`, `.env.local`, `.env.*.local` and `.env.production` and allow `.env.example`, in each file's own syntax.
- [ ] `Bash(git diff:*)` leaves the Claude Code allow list; `git status` and `git log` stay.
- [ ] OpenCode's `bash` rule denies a command that names an env file, under `--auto` included: `cat .env.local`, `grep KEY .env`, `cp .env.local /tmp/x` are refused; `pnpm test` and `git status` still ask.

### Constraints

Only `.claude/settings.json`, `.codex/config.toml` and `opencode.jsonc` change; `scripts/agent-config.test.ts` keeps passing.

### Related code and docs

`.claude/settings.json`, `.codex/config.toml`, `opencode.jsonc`, `docs/agentic-development.md` (the permissions table, not changed here).

### Test

`pnpm exec vitest run scripts` passes; by hand, `codex sandbox --permission-profile workbot -- cat .env.production` is refused.

## F-34 Working guide: what each CLI enforces, and whose briefs an agent may act on

### Goal

`AGENTS.md` and `docs/agentic-development.md` say the 3 CLIs never read `.env.local`. Only the read tool is denied in OpenCode; its grep and shell can still reach the file, and `opencode run --auto` approves the shell. The issue form takes free text from anyone, and the guide shows auto-approving runs taking issues as briefs.

### Acceptance criteria

- [ ] The guide's permissions table says, per CLI, what is enforced by a rule and what is instruction only.
- [ ] `AGENTS.md` and the guide say that issue and pull request text from non-collaborators is data, not instructions, and that auto-approving runs take only briefs a maintainer wrote.
- [ ] No sentence claims more than the configurations enforce.

### Constraints

Only `AGENTS.md` and `docs/agentic-development.md` change; no configuration.

### Related code and docs

`AGENTS.md` ("Working across CLIs"), `docs/agentic-development.md`.

### Test

Check by reading; `pnpm lint` passes.

## F-35 Chat CLI: flags are validated and --help works

### Goal

`cli/chat.ts` dies with a raw ZodError stack on a bad `--provider` or `--effort`, turns `--max-tokens abc` into NaN that fails on the first message, throws on `--help`, and its help text leaves out `/help`.

### Acceptance criteria

- [ ] A bad provider, effort, max-tokens (a positive integer) or temperature (a finite number) prints the valid values and the usage to stderr and exits 1, with no stack trace.
- [ ] `--help` prints every flag and exits 0.
- [ ] `/help` is in the help text, and `/model nope` answers with the valid providers.

### Constraints

Only `cli/chat.ts` and a new test change.

### Related code and docs

`cli/chat.ts` (the argument parsing and the slash commands), `src/lib/providers.ts` (the provider names).

### Test

New `cli/chat.test.ts`: spawn the CLI (`spawnSync(process.execPath, ["--import", "tsx", "cli/chat.ts", "--provider", "nope"])`) with empty stdin; status 1, `anthropic` in stderr, no `ZodError`.

## F-36 Extraction eval: the field matcher in the library, tested

### Goal

The matcher behind every "fields right" number lives in `cli/extract-eval.ts` with no test, and cannot be imported without the CLI's side effects; the run exits 0 whatever it scores.

### Acceptance criteria

- [ ] `same` and `normal` move to `src/lib/field-match.ts` and the CLI imports them.
- [ ] Tests cover string containment ignoring case and spacing, a list containing every expected item, nested records, number equality, and an undefined value.
- [ ] The run exits 1, naming the document, when a kind is misclassified or a source file is missing.

### Constraints

`cli/extract-eval.ts`, the new module and its test change; nothing else.

### Related code and docs

`cli/extract-eval.ts`, `content/eval/documents/expected.json`.

### Test

New `src/lib/field-match.test.ts`: `same([{ a: 1 }], [{ a: 1 }, { a: 2 }])` is false, an undefined actual value against an expected one is false, and the cases above.

## F-37 Browse CLI: the exit code says how the run ended

### Goal

`cli/browse.ts` exits 0 when the agent gave up or hit the step limit, and `--start example.com` (no scheme) crashes in `new URL` with a TypeError stack.

### Acceptance criteria

- [ ] Only `done` exits 0; `gave_up` and the step limit exit with documented non-zero codes.
- [ ] A `--start` that is not an absolute http(s) or file URL is rejected before Chrome launches.
- [ ] `--help` prints usage and exits 0.

### Constraints

Only `cli/browse.ts` and a new test change.

### Related code and docs

`cli/browse.ts`, `src/lib/browser-agent.ts` (the outcomes it returns).

### Test

New `cli/browse.test.ts`: spawn with `--start example.com x`; status 1 and no `TypeError`.

## F-38 Extract CLI: clear errors for the kind, the path and the type

### Goal

`cli/extract.ts` throws a raw ZodError on an unknown `--as`, hard-codes the kinds in its usage, prints an ENOENT stack for a missing path, and sends any other extension, a `.docx` included, to the model as text.

### Acceptance criteria

- [ ] The usage is built from `documentTypes`, and a bad `--as` is rejected before the file is read.
- [ ] A missing path exits 1 with one line naming it.
- [ ] An extension that is neither in `mediaTypes` nor plain text (`.txt`, `.md`, `.eml`, `.html`) exits 1 listing the supported ones, before any model call.

### Constraints

Only `cli/extract.ts` and a new test change; `src/lib/extract.ts` does not.

### Related code and docs

`cli/extract.ts`, `src/lib/extract.ts` (`mediaTypes`, `fromPath`), `src/lib/document-model.ts` (`documentTypes`).

### Test

New `cli/extract.test.ts`: spawn with `content/eval/documents/email-1.txt --as memo`; status 1 and the kinds in stderr.

## F-39 Traces page: say when there is nothing, date the older rows

### Goal

On a day with no calls the latency tile in `src/app/admin/traces/page.tsx` reads "0 / 0 ms" and the 3 tables are empty under their headers; "Latest calls" shows the newest 20 of all time with only a time of day; a failure's message is only in a hover title.

### Acceptance criteria

- [ ] Empty tables say "No calls in the last 24 hours", and latency shows a dash when there are no calls.
- [ ] Rows from before today show their date.
- [ ] A failure's message is readable without hovering.

### Constraints

`src/app/admin/traces/page.tsx`, a new `src/lib/format.ts` and its test change; `src/lib/tracing.ts` does not.

### Related code and docs

`src/app/admin/traces/page.tsx`, `src/lib/tracing.ts` (`traceSummary`, read only).

### Test

New `src/lib/format.test.ts`: `when(at, now)` returns only the time for today and includes the day and month for an earlier day.

## F-40 Site: a 404 page

### Goal

`site/src/app` has only a layout and a landing page, so an unknown path shows the framework's default 404 with no way back.

### Acceptance criteria

- [ ] `site/src/app/not-found.tsx` has an h1, one sentence and a `next/link` to `/`, styled with the site's Tailwind classes (the site has no shadcn).
- [ ] No new dependency; `pnpm --filter workbot-site check` passes.

### Constraints

Only the new page and its test change.

### Related code and docs

`site/src/app/page.tsx` (the style to match), `src/app/not-found.tsx` (the app's own 404, as a model).

### Test

New `site/src/app/not-found.test.tsx`: render with `renderToStaticMarkup` and assert `href="/"`.

## F-41 Site layout: a title template, Open Graph and a footer

### Goal

The site's metadata in `site/src/app/layout.tsx` is a bare title and description, with no title template and no Open Graph, and the site links to nothing, not even the 2 pages the README points to.

### Acceptance criteria

- [ ] `title` has a `default` and a `template`, and `openGraph` is set, without inventing a URL or `metadataBase`.
- [ ] A footer links to both README URLs with descriptive text.
- [ ] `pnpm --filter workbot-site check` passes.

### Constraints

Only `site/src/app/layout.tsx` and a new test change.

### Related code and docs

`site/src/app/layout.tsx`, `src/app/layout.tsx` (the app's metadata, as a model), `README.md` (the 2 URLs).

### Test

New `site/src/app/layout.test.tsx`: mock `next/font/google` with `vi.mock`, assert the template and the footer hrefs.

## F-42 Backlog: rows for every ticket that has criteria

### Goal

The table in `docs/backlog.md` ends at WB-35 while 13 later tickets have acceptance criteria below it, so they have no size and no status in the one place agents read tickets by path.

### Acceptance criteria

- [ ] One row per ticket from WB-36 to WB-48, titles identical to their headings; status `done` when a commit on `main` cites the id, `open` otherwise.
- [ ] A test asserts every heading id has a row with the same title.

### Constraints

`docs/backlog.md` and a new test change; nothing else.

### Related code and docs

`docs/backlog.md`.

### Test

New `scripts/backlog.test.ts`: every `### WB-n Title` heading has a table row with the same title.

## F-43 .env.example lists every variable config reads

### Goal

`src/lib/config.ts` reads `POSTHOG_HOST` and `POSTHOG_API_HOST`, neither of which is in `.env.example`, though `AGENTS.md` says the example lists every variable.

### Acceptance criteria

- [ ] Both are added, commented out, with their defaults.
- [ ] A test checks that every `process.env.X` read in `config.ts`, `VERCEL_*` and `NODE_ENV` aside, appears in `.env.example`.

### Constraints

`.env.example` and a new test change; `src/lib/config.ts` does not.

### Related code and docs

`.env.example`, `src/lib/config.ts`.

### Test

New `scripts/env-example.test.ts`, as described.

## F-44 Golden set: every criterion names a document the eval can reach

### Goal

The eval answers with the customer tools, which read only `faq/` and `policies/`, yet 2 golden cases require naming a document under `manuals/`, so they cannot pass. There is no FAQ-sourced answer case and no legal escalation case, though the customer note says legal questions are routed.

### Acceptance criteria

- [ ] Every document a criterion names lives under `faq/` or `policies/`.
- [ ] One FAQ answer case and one legal escalation case are added, and the count in `README.md` is updated.
- [ ] A test parses the file with `Golden`, checks ids are unique, each kind has at least 3 cases, and every backticked path in a criterion (such as `policies/refunds.md`) is a file under `content/knowledge/faq/` or `content/knowledge/policies/`.

### Constraints

`content/eval/golden.json`, one line of `README.md` and a new test change; nothing else.

### Related code and docs

`content/eval/golden.json`, `src/lib/eval.ts` (`Golden`, `answer`), `src/lib/knowledge-tools.ts` (the customer tool set), `brain/customers/fieldstone-supply.md`.

### Test

New `src/lib/golden.test.ts`, as described; it fails today on the 2 cases that name a manual.

## F-45 Requests list: the chosen filter, a count, and an empty result that says so

### Goal

On `/requests` the chosen filter is shown only by button style, the filter rows have no group label or result count, and a filter that matches nothing shows "No requests yet.", the same text as an empty database.

### Acceptance criteria

- [ ] The chosen link has `aria-current="page"`, and each row is a group labelled Team or Status.
- [ ] A count ("3 requests") sits above the table.
- [ ] An empty filtered result says "No requests match these filters" with a link that clears them; an empty database still says "No requests yet."

### Constraints

`src/app/requests/page.tsx`, `src/components/request-list.tsx`, a new `src/components/filter-row.tsx` and its test change; nothing else.

### Related code and docs

`src/app/requests/page.tsx`, `src/components/request-list.tsx`.

### Test

New `src/components/filter-row.test.tsx`: with the filter `{ team: "finance", status: "done" }`, only the Done link is current, and the Open link's href is `/requests?team=finance&status=open`.

## F-46 Request page: status buttons show progress and cannot double-send

### Goal

The "Mark …" buttons on `/requests/[id]` are plain buttons in one form, so nothing shows a click registered, and a second click sends a second update and a second status-changed event.

### Acceptance criteria

- [ ] Each next status is its own form with a `PendingButton`, so the clicked button shows its busy state and is disabled.
- [ ] The buttons sit in a group labelled "Change status".

### Constraints

`src/app/requests/[id]/page.tsx`, a new `src/components/status-actions.tsx` and its test change; `src/app/requests/actions.ts` does not.

### Related code and docs

`src/app/requests/[id]/page.tsx`, `src/components/pending-button.tsx`, `src/app/requests/actions.ts` (the status change, unchanged).

### Test

New `src/components/status-actions.test.tsx`: for status `open`, 2 forms ("Mark in progress", "Mark done") inside the labelled group.

## F-47 Chat: readable errors with retry, announced replies, Enter that respects composition

### Goal

In `src/components/chat.tsx` the AI SDK puts the raw response body in the error message, so a 429 shows as a JSON string with no way to retry; the "Thinking" indicator has a label but no role and the transcript is not announced; Enter sends while an input method editor is still composing.

### Acceptance criteria

- [ ] A 429 shows the plain sentence from the JSON body, with a Retry button that calls `regenerate()`; a body that is not JSON shows the message as is.
- [ ] The transcript is `role="log"` and the indicator `role="status"`.
- [ ] Enter while `nativeEvent.isComposing` is true does not send.

### Constraints

Only `src/components/chat.tsx` and a new test change.

### Related code and docs

`src/components/chat.tsx`, `src/app/api/chat/route.ts` (the 429 body).

### Test

New `src/components/chat.test.tsx`: an exported `errorText()` returns the JSON's `error` field, or the plain message when the body is not JSON.

## F-48 Admin overview: the status cards link to the list and reuse the summary

### Goal

The overview in `src/app/admin/page.tsx` counts statuses itself although `requestSummary` already does, and its cards link nowhere even though `/requests` filters by status.

### Acceptance criteria

- [ ] Each card is a link to `/requests?status=<status>`.
- [ ] The counts come from `requestSummary().byStatus` and the table from the summary's latest 5.

### Constraints

`src/app/admin/page.tsx`, a new `src/components/status-counts.tsx` and its test change; `src/lib/requests.ts` does not.

### Related code and docs

`src/app/admin/page.tsx`, `src/lib/requests.ts` (`requestSummary`, read only).

### Test

New `src/components/status-counts.test.tsx`: 3 links with the 3 status hrefs, each showing its count.

## F-49 Inbox: labels for the step in progress, reasons beside Failed, named buttons

### Goal

The inbox at `/admin/inbox` labels each status one step late (`extracted` reads "Extracting", extraction itself reads "Received"), puts a failed run's error under "To check" because `markFailed` stores it in the review column, and names every row's buttons just "Approve" and "Reject".

### Acceptance criteria

- [ ] Each label names the step in progress.
- [ ] "To check" lists fields only on rows awaiting review; a failed row shows its reason beside the Failed badge.
- [ ] Each button's accessible name includes the document name.

### Constraints

`src/app/admin/inbox/page.tsx`, a new `src/components/inbox-status.tsx` and its test change; `src/lib/inbox.ts` and the actions do not.

### Related code and docs

`src/app/admin/inbox/page.tsx`, `src/inngest/document-approval.ts` (when each status is set), `src/lib/inbox.ts` (`markFailed`).

### Test

New `src/components/inbox-status.test.tsx`: a failed item shows its reason next to "Failed"; an item awaiting review has a button labelled `Approve <name>`.

## F-50 Prompts page: a bad split or a short prompt is a message, not the error page

### Goal

On `/admin/prompts`, shares that do not total 100 make `setShares` throw, and a prompt under 20 characters makes the version schema throw; neither is caught, so the root error page replaces the admin console.

### Acceptance criteria

- [ ] A split that does not total 100 shows "Shares add up to 90, not 100." beside the save button and keeps the shares as entered.
- [ ] A running total updates as shares are typed.
- [ ] The note field has `maxLength` 200 and the prompt field `minLength` 20, with a message under the field instead of the error page.

### Constraints

`src/app/admin/prompts/page.tsx`, `src/app/admin/prompts/actions.ts` and a new test change; `src/lib/prompts.ts` does not.

### Related code and docs

`src/app/admin/prompts/page.tsx`, `src/app/admin/prompts/actions.ts`, `src/lib/prompts.ts` (`setShares`, read only).

### Test

New `src/app/admin/prompts/actions.test.ts`: shares of 50 and 40 return the message "Shares add up to 90, not 100." with the entered values, and leave the stored shares unchanged.
