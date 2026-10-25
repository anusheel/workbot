# Fieldstone Supply

A building-supply company with a warehouse in Oakland, 6 delivery vans, and operations, finance and support teams. WorkBot is their internal assistant and the chat on their site.

## Teams and what they own

| Team       | Owns                                             | Asks WorkBot for                                                                       |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Operations | the warehouse, receiving, vendors, fleet, badges | vendor onboarding steps, delivery and damage procedures, requests filed from documents |
| Finance    | invoices, payment runs, expenses, travel         | approval limits, payment terms, invoices read into requests                            |
| Support    | customers, refunds, returns, the FAQ             | refund rules, return windows, what to tell a customer                                  |

## Their documents

52 documents in `content/knowledge`: policies (refunds, expenses, vendor onboarding, data retention, incident response, remote work, support SLA, travel), manuals (receiving, picking, returns, shipping cutoffs, invoice approval, purchase orders, vendor payment run, fleet, forklift safety, badges, visitors, closing and opening checklists, inventory counts, damaged goods), IT how-tos, the customer FAQ and HR documents. Each has an owner team and an updated date. The documents are the source of truth for every answer; a gap is a gap, not a guess.

## What they asked for, and what they were promised

A queue that every channel feeds (form, API, email, voice, documents); answers with the document named; nothing approved, paid or refunded by the assistant; incidents, legal and HR questions pointed to the responsible team; the public chat limited to the customer-facing sections. Promised and measured: the golden cases in `content/eval/golden.json`, scored before a prompt takes traffic.

## In the code

The customer is configuration: `content/customer.json` holds the name, what the company is, the teams and what each files, where a document of each kind is filed, and the sections customers may read. The prompts, the request model and the filing rules read it; nothing else in `src/` names the company.

## Contacts

Named in the knowledge base by role, never by person: the owner team on each document is the contact for it.
