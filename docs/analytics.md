# Analytics

How WorkBot's use is measured and asked about: a dataset in a locked DuckDB, the metrics written as SQL with tests, a weekly report, and an analyst agent that answers in SQL it shows. The research dossier on WorkBot's market is published on the public site.

## The stack, and why not more of it

| Piece              | Here                                                                           | At a larger scale                           |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------- |
| Store and engine   | DuckDB in memory, opened per run, locked (no file, no network)                 | ClickHouse fed by the event stream          |
| Data               | `content/analytics/seed.sql`: 90 days for two tenants, made the same every run | a nightly copy of the tables and the events |
| Semantic layer     | `content/analytics/metrics/*.sql`, one definition a file                       | the same files, versioned with the code     |
| Data tests         | `content/analytics/tests/*.sql`: a query that must return no rows              | the same                                    |
| Dashboards         | `pnpm analytics report`: every metric, then a summary to review                | Metabase or Hex over the same definitions   |
| Questions in words | `pnpm analytics ask "…"`                                                       | the same agent, pointed at the warehouse    |

At two tenants and a few thousand rows a warehouse and a BI server are two more systems to run for nothing a single file of SQL cannot do. The definitions are the part that lasts: when the volume calls for ClickHouse, the metrics move as written. The dataset is synthetic, made by a hash of person and day so that every run has the same rows and the known answers stay known; people are ids, never names.

## The five analyses

1. **Weekly active people**, by tenant.
2. **Retention**: of those who joined in a week, the share active each week after.
3. **What people use it for**: chats, requests and documents by month.
4. **Spend per active person** per month, by tenant.
5. **New people** each week.

Each is one SQL file with its title as the first line. The data tests check the dataset and the definitions together: no one active before joining, and no cohort retaining more than it had.

## The analyst

`src/lib/analysis.ts` gives the model one tool, a query that runs a single SELECT in the locked DuckDB: at most 50 rows back, a time limit per query, and a step and dollar limit per question. The metric definitions are in its instructions, so "retention" means what the team means. Every answer comes back with the SQL that produced it.

| Known answer, from SQL written by hand           | Expected | The analyst                          |
| ------------------------------------------------ | -------- | ------------------------------------ |
| How many people have joined in total?            | 300      | 300, `select count(*) … from people` |
| How many chat uses were there in September 2026? | 546      | 546, with the month's filter shown   |
| Harbor Dental's total cost, to two decimals      | $0.42    | $0.42, filtered by tenant            |

The first run of the check failed safe: the query tool requires a viewer's role, checked outside the model since Day 30, and the terminal had not said who it was. It runs as the operator now, as the other commands do.

The weekly report is every metric's table, headed by the analyst's four-sentence summary, which a person reads before the report goes anywhere.

## The research dossier

The question: how independent building-supply dealers take contractor orders and handle supplier invoices, what software they use, and what they spend. An agent harvested 76 sources and extracted 47 claims, each cross-checked against the others and labelled by confidence (high: two independent sources or a survey with a method; medium: one credible source; low: a vendor's claim or a single unclear source). It is published at `/research` on the public site, with the dataset at `/research/dossier.json`.

What it found, briefly: dealers run an LBM-specific ERP (Epicor BisTrack, ECI Spruce, DMSi Agility, smaller ones below), contractors still order by phone, text, email and PDF that staff key in, supplier invoices arrive as PDFs and paper that accounts payable keys and matches, and software spend is unpublished, with only third-party estimates. Several vendors now sell AI order entry to the same dealers, with every performance figure their own. The weakest part of the dossier is spend: no survey measures it.
