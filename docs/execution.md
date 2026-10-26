# Execution models

Every operation WorkBot performs, sorted into the four kinds of work, with where it runs and why. A request answers in a few seconds while the caller waits; a stream sends as it goes; a job runs off the request for seconds to minutes and is retried; a workflow runs for minutes to days, durable across restarts and waiting on people and events. Most products need all four, and the mistakes are the operations filed under the wrong one.

## The map

| Operation                                                                           | Kind                     | Runs on                                     | Why                                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Pages, lists, status changes, notes, sign-in, link codes                            | request                  | serverless function                         | a database read or write, well under a second                                                 |
| `POST /api/requests`, `GET /api/documents/[id]`, conversation reads                 | request                  | serverless function                         | the same                                                                                      |
| `POST /api/intake`: triage of a message into a request                              | request                  | serverless function                         | one small-model call, 1 to 2 s, and the caller wants the request back                         |
| Webhooks from GitHub, Twilio and Slack                                              | request                  | serverless function                         | check the signature, hand the work on, answer within the provider's few seconds               |
| A voice turn, `POST /api/voice`                                                     | request                  | serverless function                         | one turn, 1 to 3 s, spoken as soon as it is back                                              |
| The chat, `POST /api/chat`, and a page laid out, `/api/generate`                    | stream                   | serverless function                         | tokens as they come, over server-sent events; the chat resumes after a reload                 |
| A live voice call to a supervisor                                                   | stream                   | the realtime server (container)             | two-way and long-lived, which a serverless function cannot hold                               |
| `POST /api/documents`: reading a document with the model                            | job                      | Inngest, step by step                       | two model calls and retries, 5 to 15 s; the API answers 202 and the workflow does the reading |
| A text message answered (`channel-reply`)                                           | job                      | Inngest                                     | a model turn and a send that may need retrying; one at a time per sender, in order            |
| Domain events handed to consumers (`dispatch-events`)                               | job                      | Inngest, every minute                       | at least once, in order, each consumer from its own position                                  |
| Memory learned after a reply                                                        | job                      | after the response; a step on text channels | the reply should not wait for it                                                              |
| Ticket sync, nightly reconciliation, retention, the hourly watch, morning reminders | job                      | Inngest crons                               | scheduled, retried, nobody waiting                                                            |
| Document approval                                                                   | workflow                 | Inngest                                     | waits up to 3 days for a reviewer, holding no server                                          |
| Uploading one document on the new-request page                                      | request                  | server action                               | the person waits for the record they asked for; bulk goes through the inbox and the workflow  |
| A question about a sheet                                                            | request                  | server action                               | the person waits for the answer, 5 to 10 s; streaming it would be the next step               |
| Investigating a request, reading a recording                                        | request, should be a job | server action, up to 300 s                  | an agent run of minutes inside a request; the next to move, with progress on the page         |

## Jobs: the queue

WorkBot's queue is Inngest's, already running its workflows; a second engine for jobs would be a second thing to operate. What it provides, and what the code sets:

- **At least once.** An event can be delivered twice and a step can run twice, so every effect is keyed: a document's row, a reply's outbound row (unique per message answered), a notification per event.
- **Backpressure and fairness.** Each function caps its runs per owner and in all: two documents at a time per sender and ten in all, one reply at a time per phone number (which also keeps a person's messages in order) and twenty in all. A sender with a backlog waits for its own slots; it cannot take everyone's.
- **Retries.** Three, with exponential backoff and jitter. A failure no retry can fix, such as a document the provider rejects as malformed, ends the run at once (`src/inngest/fail-fast.ts`).
- **Dead letters.** A run that gives up is kept in `dead_letters` with its event, its owner and the error; `/admin/jobs` lists them and an admin sends one back once the cause is fixed.

### The load test

`pnpm load` runs on the engine and the dev server: a noisy integration sends 300 documents first, 100 of them PDFs the provider rejects, then 4 others send 50 each. Each document is read by the small model, two calls.

| Cap per sender | Sender               | Sent | Read, for review | Failed, dead-lettered | Median wait | Last done    |
| -------------- | -------------------- | ---- | ---------------- | --------------------- | ----------- | ------------ |
| 2 of 10        | noisy                | 300  | 200              | 100                   | 198 s       | 385 s        |
| 2 of 10        | each of the 4 others | 50   | 50               | 0                     | 43 to 54 s  | 85 to 97 s   |
| 5 of 10        | noisy                | 300  | 200              | 100                   | 85 s        | 152 s        |
| 5 of 10        | each of the 4 others | 50   | 50               | 0                     | 20 to 87 s  | 135 to 139 s |

Every document ended read and waiting for a reviewer (a field under the confidence bar, as the approval workflow intends) or failed with a dead letter; none was lost or left unfinished. The dead letters are exactly the 100 broken PDFs, each failed on its first attempt with the provider's "The PDF specified was not valid", not retried.

Fairness has a price. With a cap of 2, the others finished within 97 s of sending while the noisy backlog ran on; after that, 8 of the 10 slots sat idle for nearly 5 minutes, because a hard cap does not lend its unused slots. With a cap of 5 the batch finished in 156 s instead of 386 s, and the others waited about 40 s longer. WorkBot keeps 2: people uploading a few documents should not wait on an integration's bulk run. A scheduler that lends idle slots, or a lower priority for bulk senders, would get both.

## Events: pub/sub on Postgres

A request is written with its `request.created` event in one statement, so neither exists without the other, the outbox pattern without a relay to run. Each consumer, notifications and analytics today, reads the events after its own position, in order, and moves its position after each one. Order is by the transaction that wrote an event, not its id: ids are handed out before commit, so a lower id can commit after a higher one, and a reader going by id would pass it for good. A consumer reads only events from transactions older than every one still running, none of which can still commit, and keeps its position as that transaction and id. Delivery is at least once, so a consumer whose effect must not repeat is idempotent by the event's id: a notification is made once however often its event is read. Analytics accepts the rare repeat. A consumer that fails one event three times dead-letters it and passes it, so one bad event cannot hold up the rest.

Events are versioned like an API. A consumer reads the fields it needs and lets new ones pass, so a producer can add a field freely; a change that would break a consumer is a new version, and a consumer without a reader for it dead-letters the event rather than misreading it.

## Streams

**Server-sent events for the chat.** One direction, through any proxy, the default for text. A reply in progress is also kept in parts (`streams` and `stream_parts`, about a tenth of a second each). A browser that reloads mid-reply asks `GET /api/chat/<id>/stream` and gets the reply from its start, then each part as it is written, until it ends; 204 when nothing is under way. The AI SDK's `useChat` asks on its own (`resume: true`). The SDK's resumable streams expect Redis; WorkBot has Postgres, so the parts go there and the reader polls every 200 ms, which fits inside a function's limit. On the dev server, a reply cut off after 211 characters was replayed whole, 142 events, and followed to its end 1.5 s later.

**WebSockets for live calls.** Two-way and long-lived, so they run on a realtime server, `pnpm realtime`, a container rather than a function. A voice call joins a room named by an id only its page holds and publishes each turn; staff watch every call at `/admin/calls`, and an agent can say something into one, which appears on the caller's screen. Each instance listens on a Postgres channel and publishes every frame with NOTIFY, so a supervisor on one instance follows a call on another: run as many as the load needs, behind a load balancer that keeps each socket on one instance. Two instances ran on 3301 and 3302: the caller's turn reached the supervisor on the other instance, and the supervisor's note reached the caller, each in the same tenth of a second. NOTIFY keeps nothing, so a supervisor who connects late sees calls from then on, and a payload is at most 8,000 bytes, which a turn of speech is far under.

## Serverless, and what it cannot do

The app runs as serverless functions: good at requests and short streams with bursty load, scaled per request, nothing to keep warm. What to read before designing for it, on Vercel:

- **Duration.** A function runs for a limited time: `maxDuration`, set per route here, up to a maximum that depends on the plan. The request page asks for 300 s for an investigation, which fits only on a paid plan; that is the reason it should be a job.
- **Request size.** A function's request body is capped at 4.5 MB. Recordings and large files must go to storage directly and be read from there; a server action's own size setting does not lift the platform's cap.
- **Cold starts.** The first request on a new instance pays for loading the code; the Slack adapter's bot id is configured rather than looked up for the same reason.
- **No long-lived connections.** A function cannot hold a WebSocket or a database listener between requests. The realtime server runs as a container for that.
- **Many at once.** Instances start together, and each applies the schema on its first query. `create table if not exists` is not safe against itself: three processes started at once on an empty database failed two of three. The schema is now applied under an advisory lock, one instance at a time.

The mix: serverless for the web and the API, Inngest for jobs and workflows (it calls back into the functions one step at a time, so no step outlives a function's limit), a container for WebSockets, Postgres for everything kept.
