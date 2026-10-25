# Backlog

The Linear workspace for WorkBot, mirrored here so agents can read it by path.
One ticket per small change. The acceptance criteria are what the review
checks. Sizes: S is under an hour, M is a few hours.

| Ticket | Title                                      | Size | Status |
| ------ | ------------------------------------------ | ---- | ------ |
| WB-1   | Landing page                               | S    | done   |
| WB-2   | Health endpoint                            | S    | done   |
| WB-3   | Deployment settings page                   | S    | done   |
| WB-4   | CI on every pull request                   | S    | done   |
| WB-5   | Request model with validation              | S    | done   |
| WB-6   | Intake form                                | M    | done   |
| WB-7   | Requests list                              | S    | done   |
| WB-8   | Requests API                               | S    | done   |
| WB-9   | Admin console shell                        | S    | done   |
| WB-10  | Request counts on the admin overview       | S    | done   |
| WB-11  | Settings inside the admin console          | S    | done   |
| WB-12  | Request detail page                        | S    | done   |
| WB-13  | Change a request's status                  | S    | done   |
| WB-14  | Filter requests by team and status         | S    | done   |
| WB-15  | Policies as Markdown documents             | M    | done   |
| WB-16  | Public site scaffold                       | S    | done   |
| WB-17  | Postgres persistence for requests          | M    | open   |
| WB-18  | Analytics on the intake funnel             | S    | open   |
| WB-19  | Validation messages from the API in the UI | S    | open   |
| WB-20  | Request detail: comments                   | M    | open   |

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
