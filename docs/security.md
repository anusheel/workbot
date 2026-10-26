# Security note

What the assistant can do, what it cannot, what is stored where and for how long. Written for the customer's security reviewer; every claim names the code or the test that holds it.

## Who can do what

| Caller                          | Reaches                                                                                                                        | Cannot                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| The public, signed in as no one | the chat, with the customer-facing documents, a calculator and public web pages; the voice line                                | any ticket, contact, note, request list, admin page or employee document |
| Viewer                          | every employee page, read only; the chat with the whole knowledge base, tickets and contacts to read                           | file, comment, save, change a status, sync, approve                      |
| Agent                           | everything a viewer does, and the writes: file and comment on tickets, save notes, file and change requests, approve documents | change prompts, reconcile, run reminders, manage people                  |
| Admin                           | everything, including users, keys, prompts and the nightly jobs on demand                                                      | read another customer's data                                             |

A person or a service signs in with a key: shown once, stored as its SHA-256 hash, revocable, and a second key can be issued before the first is revoked so a service moves without downtime (`src/lib/auth.ts`). A browser holds a 7-day session, not the key; revoking the key ends its sessions.

## Below the model, not in the prompt

What the assistant may do is decided by the caller's role in code, never by what it was told:

- The chat offers a caller only the tools their role reaches, and every tool checks the role again when it runs (`src/lib/tool.ts`). A tool definition does not compile without the role it requires.
- Every page, server action and API route checks the caller where the data is read; the proxy's earlier check only turns away a request with no credentials at all.
- Writes to the ticketing system go through 2 product-level tools that are made once per key and take a dry run; nothing closes, reassigns or deletes a ticket.
- SQL the model writes about a spreadsheet runs in a DuckDB of its own, in memory, holding only that sheet: it cannot read a file, reach the network, load an extension or change its own settings, and it runs one SELECT at a time, returns at most 50 rows and is stopped after 5 seconds (`src/lib/sheets.ts`, tested in `src/lib/sheets.test.ts`).
- Each customer's rows are separated in the database itself: every table has a tenant column and a forced row-level security policy, and the app connects as a role that owns no table and bypasses nothing (`src/lib/schema.ts`, `src/lib/db.ts`). A query that forgets a filter still sees only its own customer's rows; search filters by tenant before it ranks.

Text the assistant reads, a ticket, a contact, a web page, a document, is data. An instruction planted in it can change what the assistant says, not what its role lets it do; 20 such attempts, through the chat, tool results and documents, run as an eval (`pnpm eval --task security`) and in CI on every change to a prompt, a tool or a model. On 2026-10-25 all 20 failed, twice each; that is evidence about these attempts, not a guarantee against others. An agent's assistant is offered the write tools its role allows, so a planted instruction could lead it to attempt one, and only the model's judgment stops that; actions that deserve a person's sign-off should get a confirmation step.

## What is stored, where, for how long

| Data                                                      | Where                                                                                                                                 | Kept                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Requests, documents' extracted records, tickets, contacts | the customer's rows in Postgres                                                                                                       | as long as the customer keeps them                                          |
| A document's original bytes                               | the inbox table                                                                                                                       | 30 days after its run ends, then the bytes are cleared and the record stays |
| An uploaded spreadsheet                                   | the sheets table, the file as it came                                                                                                 | 30 days, then deleted                                                       |
| Memories                                                  | per signed-in user, or per browser for a visitor                                                                                      | until the person forgets them on the settings page                          |
| Traces of model calls                                     | Postgres: caller, task, model, tokens, cost, latency, an error with personal data and secrets redacted; never the prompt or the reply | 90 days                                                                     |
| Measurements (cache reads, sync log)                      | Postgres                                                                                                                              | 30 days                                                                     |
| Keys and sessions                                         | hashes only                                                                                                                           | until revoked or expired                                                    |
| Integration tokens a person connects                      | sealed with AES-256-GCM under `SECRETS_KEY`, opened only for the call that needs it                                                   | until the person or an admin disconnects it                                 |

The windows are configuration (`content/defaults.json`), and a customer's file can shorten them; a nightly job deletes what has outlived them (`src/inngest/retention.ts`).

## Keys and secrets

Every secret the app needs is an environment variable read at runtime in one module (`src/lib/config.ts`): never in the browser, a prompt or the repository. The sealing key rotates without downtime: the new key goes in `SECRETS_KEY`, the old one in `SECRETS_KEY_PREVIOUS`, `pnpm users reseal` seals every token again, and the old key goes. Model provider keys are the provider's; spending is watched hourly against a daily budget (Day 19).

## Providers

Model calls go to Anthropic's API. What a provider keeps, its zero-data-retention options and its regions are terms of the customer's contract with that provider; this deployment sends no data it does not need for the call, and keeps no prompt or reply.

## What is not here yet

- Single sign-on: people sign in with a key an admin issues; a customer's identity provider is the next step.
- A per-customer database login: tenants sharing a database are separated against the app's own queries, not against someone holding the database credentials. A customer who needs that gets a database of its own.
- Regional model endpoints and an automated leaked-key scan.
