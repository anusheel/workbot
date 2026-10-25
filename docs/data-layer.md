# The data layer under the integrations

Day 27 connected one system. This is the layer that keeps what comes from it correct and fresh: one shape for tickets and contacts whatever their source, 3 sync paths with what each found written down, a rule table applied to every record before the model sees it, and a cache that says how old what it serves is. Every number here was measured on this repository; what was not built says so.

## One shape

A ticket is a GitHub issue or a WorkBot request; a contact is a document's sender or a login on a ticket. Each lives in one table (`src/lib/schema.ts`), mapped by one function per source (`src/lib/unified.ts`), with the provider's record kept whole in `raw` and the rules that fired in `applied`:

| Concept | Sources                                                           | Shape                                                            | Key                                                                                    |
| ------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ticket  | GitHub issues (listed or delivered); WorkBot requests             | key, title, body, state, assignee, labels, team, url, updated_at | `source#key`: `github#164`, `workbot#<uuid>`                                           |
| contact | invoice vendors, email senders, letter writers; logins on tickets | name, email, phone, company, url, updated_at                     | the email when there is one, so a sender seen twice is one row that keeps what it knew |

An issue maps the same whether the server listed it (labels as names, `OPEN`) or a webhook delivered it (labels as objects, `open`): one mapping reads both shapes, and the test holds the two results equal. Invoices carry the vendor's email and phone since today, so a sender can be reached.

Not unified: deals, since WorkBot has no CRM; invoices stay documents, with the rules applied as they are saved. The Day 27 table became this one by changing its create statement before anything was deployed; after a deployment the same change is a migration, written before the deploy.

## Three sync paths

| Path      | Runs                          | Does                                                                                                    | Logs                                     | Measured here                                         |
| --------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| pull      | every 15 minutes, on demand   | the issues changed since the latest `updated_at` stored, 100 a page; every request; every contact       | `pull`, with how far behind the copy was | median 80 s behind                                    |
| webhook   | on a signed `issues` delivery | replaces the issue's row now                                                                            | `webhook`, with how far behind           | median 2 s behind, from a signed copy of a real issue |
| reconcile | nightly at 03:30, on demand   | reads every issue; fixes rows the copy had older than the system; drops rows the system no longer lists | `missed` and `gone`, one row each        | 1 missed, 0 gone, over 62 issues                      |

The pull is the cursor path of Day 27; the first pull is the backfill. The webhook is `POST /api/webhooks/github` (`src/app/api/webhooks/github/`), which checks the `X-Hub-Signature-256` against `GITHUB_WEBHOOK_SECRET` with a constant-time comparison and refuses what does not match. A real delivery needs a public address, which this run does not have; the receiver is exercised with a copy of a real issue, read through the server and signed as GitHub would. The reconciliation is the full pull: the same function with `full: true`.

Requests are mapped whole on every run, since they live in this database; contacts come from the documents table and from the logins on the tickets. On this run the one shape holds 112 tickets, 62 issues and 50 requests, and 24 contacts, 23 from the 30 documents the pipeline read and 1 login; the first pull is not logged as a lag, since the age of a backfilled issue says nothing about the path. `/admin/tickets` shows the copy, the median lag by path, what the last reconciliation found, and runs any path now.

## Rules

`content/rules.json` is an ordered table; `src/lib/rules.ts` parses it at load, refuses a team the customer does not have, and applies it:

| Rule                  | On      | When                                                                  | Then                                    |
| --------------------- | ------- | --------------------------------------------------------------------- | --------------------------------------- |
| `phone-e164`          | contact | the phone has digits                                                  | E.164, North America assumed for 10     |
| `company-from-domain` | contact | no company, an email                                                  | the domain's first label, title case    |
| `route-finance`       | ticket  | no team; invoice, payment, refund, credit, statement                  | team finance                            |
| `route-support`       | ticket  | no team; customer, complaint, delivery, order                         | team support                            |
| `route-operations`    | ticket  | no team; van, truck, dock, warehouse, printer, light, facilit, vendor | team operations                         |
| `large-invoice`       | invoice | total over 5,000                                                      | flagged for the finance lead's approval |

Each rule sees the record as the ones before it left it, so the routing rules fire at most once; a rule that would change nothing writes nothing. Every change is written on the record as rule, field, from and to: `tickets.applied`, `contacts.applied`, `documents.applied`. Anything with a right answer is a rule here, not a prompt: the team a ticket's words imply, the form of a phone number, the threshold an invoice crosses. The model gets the record after the rules, and `find_contact` normalizes a phone in the query the same way, so a number asked for in any written form finds the contact.

## The cache

`src/lib/cache.ts` caches a read per tenant: within its age the value is a hit; past it, the stale value is served while a fetch replaces it; absent, it is fetched first. Every read's outcome and age are logged. `read_url` keeps a page an hour and tells the model when it was fetched (`As of 14:02:`), so a cached policy source carries its freshness into the answer. Measured on this run: 2 reads, 50% hits, served 2 s old at the median.

What varies by source is the age: a page an hour, the tickets copy 15 minutes by pull and seconds by webhook. A CRM would want an age per field, a deal's stage hourly and an email yearly; that is the same table keyed by field, not built here. Invalidation: the webhook replaces the ticket's row, so the copy is refreshed by the system's own events; a ticket WorkBot files reaches the copy the same way, by the webhook or the next pull, rather than being written through.

## What is not here

- Deals and a second external provider: no CRM and no account for one; the shape is one table with a `source` column, and a second provider is a second mapping into it.
- A public address for deliveries, so the webhook path is proven on a signed copy, not on GitHub's own delivery.
- An alert when the copy stays stale: a token that stays expired fails the pull, which Inngest retries; the page shows the copy's age, and nothing else says so.
- Ages per field, and a cache in front of the tickets copy: the copy is the cache.
