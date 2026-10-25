---
title: Incident response
owner: Operations
updated: 2026-09-15
---

An incident is anything that stops customers ordering, stops orders shipping,
or exposes data. Declare early; a false alarm costs 10 minutes, a late
declaration costs a day.

## Severity

- Sev 1: customers cannot order, or data is exposed. Page the on-call lead and the head of operations now.
- Sev 2: a region, a warehouse or a major integration is down. Page the on-call lead.
- Sev 3: degraded service with a workaround. Open a ticket and handle it in business hours.

## During a Sev 1 or Sev 2

1. The on-call lead is the incident commander until they hand over by name
2. Open the incident channel and post a status update every 30 minutes, even when nothing has changed
3. Customer support posts the public status page update within 15 minutes of declaration
4. Nobody changes production outside the incident channel

## After

Write the postmortem within 5 business days: timeline, impact in orders and
customers, root cause, and the actions with owners and dates. Postmortems are
blameless and are read at the weekly operations review.
