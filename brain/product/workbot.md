# WorkBot

WorkBot is the assistant and workflow engine for Fieldstone Supply's operations, finance and support teams, built day by day on the AI FDE Course. One Next.js app; the public marketing site is a second app in `site/`.

## Surfaces and who uses them

| Surface                                                                                              | Who                                      | What it does                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/chat`                                                                                              | customers and employees, without sign-in | the assistant over the customer-facing documents, with memory per visitor                                 |
| `/requests`, `/requests/new`                                                                         | employees                                | the work queue: file a request, from a form or a document, and track it                                   |
| `/requests/[id]`                                                                                     | the team owning the request              | the request, the analyst's report, documents and recordings attached                                      |
| `/voice`                                                                                             | employees                                | the support line: say what happened, the request is filed                                                 |
| `/dashboards`                                                                                        | managers                                 | a page generated from the live request data                                                               |
| `/admin/*`                                                                                           | operations                               | the assistant with every tool, the inbox of documents in the approval workflow, traces, prompts, settings |
| `pnpm chat`, `pnpm explain`, `pnpm scrape`, `pnpm browse`, `pnpm video`, `pnpm extract`, `pnpm eval` | engineers                                | the terminal: the assistant, the pipelines and the evals                                                  |
| `POST /api/intake`, `/api/documents`, `/api/chat`, `/api/voice`, `/api/generate`, `/api/requests`    | integrations                             | what other systems call                                                                                   |

## What it does not do

No sign-in: a visitor is a cookie, an employee is whoever reaches the admin pages. No email or chat sending: notifications are an outbox in the database. No hosted speech: the voice line is the browser's own. No deployment yet: it runs on a machine with Chrome, ffmpeg and a Postgres.

## Where to look

The code map is in `AGENTS.md`; the system as built in `docs/architecture.md`; every feature's ticket in `docs/backlog.md`.
