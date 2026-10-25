# The company brain

What a person or an agent reads before working on WorkBot. The notes are
Markdown, read by path; nothing here is loaded into a prompt by default. Start
with the index, open what the task needs, and cite the note you relied on.

| Note                                                             | What it holds                                                                            | Reviewed   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| [product/workbot.md](product/workbot.md)                         | what WorkBot is, its surfaces, who uses each, what it does not do                        | 2026-10-25 |
| [architecture/decisions.md](architecture/decisions.md)           | the decisions behind the system as built, numbered, with what each would take to reverse | 2026-10-25 |
| [customers/fieldstone-supply.md](customers/fieldstone-supply.md) | the customer: teams, their documents, what they asked for, what they were promised       | 2026-10-25 |
| [style/writing.md](style/writing.md)                             | how we write: prompts, documents, the course, commit messages                            | 2026-10-25 |
| [style/code.md](style/code.md)                                   | how we code, in brief; the conventions themselves are in AGENTS.md                       | 2026-10-25 |

Beside the brain: `docs/architecture.md` is the system as built, `docs/backlog.md` the tickets, `docs/agentic-development.md` how we work with the CLIs. The knowledge base under `content/knowledge/` is the customer's own documents, for the assistant, not for us.

## Retention

A note carries the date it was last reviewed. A note not reviewed in 90 days is stale: the monthly review either reviews it or moves it to `archive/` with the date, where nothing is read by default. Decisions are never archived; a reversed decision is superseded in place, with the date and the reason. A customer note outlives the engagement by a year, then goes to the archive.

## Adding a note

One subject per file, the point in the first paragraph, headings that stand on their own, numerals for numbers, a `Reviewed` date in the index. Link the code or the ticket a claim comes from; a note that drifts from the code is corrected or archived at the next review.
