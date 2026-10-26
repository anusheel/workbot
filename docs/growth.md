# Growth

How WorkBot is found, and how it finds its buyers: the public site built for answer engines, a weekly measurement of whether assistants cite it, a target list scored by criteria in code, and an outreach sequence that keeps the rules. Nothing has been sent.

## The site, for answer engines

| Checklist item                                         | Where                                       |
| ------------------------------------------------------ | ------------------------------------------- |
| Every crawler allowed, the answer engines' by name     | `site/src/app/robots.ts`                    |
| A sitemap with every page and its date                 | `site/src/app/sitemap.ts`                   |
| `llms.txt`: the site in plain text for language models | `site/src/app/llms.txt/route.ts`            |
| Structured data on every page: the product, each Q&A   | `site/src/app/page.tsx`, `questions/[slug]` |
| Five pages for the five questions a buyer asks         | `site/src/site.ts`                          |
| An author and a date on every page                     | the layout's footer and each page's data    |

`pnpm check:aeo` runs the checklist as tests, and they run in `pnpm check` on every pull request, so a regression fails the build. The five questions and their answers live in one file, `site/src/site.ts`, from which the pages, the sitemap, `llms.txt` and the weekly measurement are all made.

## Measuring citations

`pnpm aeo` asks each assistant the five questions with its web search on, and records in `citations` whether the site was among the sources, and which sites were. The Inngest function `aeo-watch` runs it every Monday at 9. Only Claude is asked today; another assistant joins when its key does.

The first run, before the site is published: **0 of 5 answers cite it**, as they cannot. What they cite instead is the finding: other products called WorkBot or named alike (`workhub.ai`, `workato.com`), review sites (Capterra, SaaSworthy), and general articles. The name is shared, so an answer engine asked about "WorkBot" finds someone else's. The next iteration answers on pages that say what this WorkBot is in their first sentence (an assistant for building-supply and distribution teams), asks the questions without the name as buyers do, and measures again a week after the site is public.

## The target list

The profile is code (`src/lib/accounts.ts`): two criteria every row must meet, an independent or regional building-supply dealer in the United States of roughly 20 to 500 employees, and four that score, with points: delivers to job sites (3), takes contractors' orders by phone, text or email (3), separate departments for orders, billing or service (2), more than one location (2). An unknown fact scores nothing.

The pilot is 25 accounts in `content/growth/accounts.json`, found by an agent with web search and recording company-level facts only, each row with the pages that show them; no person's name, email or phone was collected. All 25 validate against the account's schema, they span 20 states, and every site answered when checked (one with a 403 to automated requests). Scores from the code:

| Score | Accounts                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10    | Scherer Bros. Lumber (MN), Burton Lumber & Hardware (UT), Western Building Center (MT), Talbert Building Supply (NC), New Castle Building Products (NY) |
| 7–8   | Harbin Lumber (GA), Belletetes (NH), Hamilton Building Supply (NJ), Beisser Lumber (IA), Hughes Lumber (OK), Mutual Materials (WA), Hilltop Lumber (MN) |
| 5–6   | eleven more, most with a fact the agent could not confirm                                                                                               |
| 2–3   | W.L. Tucker Supply (OH), J.H. Larson Electrical (MN), Werner Electric Supply (WI)                                                                       |

Reviewed by hand: Werner was acquired in 2026 and may no longer be independent; Mutual Materials also manufactures, so its order desk may differ; both stay off the first sends until checked. A low score is mostly unknown facts, not a poor fit; the next pass fills those before the list grows to 200.

## Outreach

A sequence of three short emails over two weeks to an account's published contact address (`src/lib/outreach.ts`), and nothing to a named person found elsewhere.

- **Every email** names the sender, carries a postal address, and has a one-click unsubscribe (the `List-Unsubscribe` headers of RFC 8058, and a link in the text). The link is signed for its address, so no one can unsubscribe someone else.
- **It stops** at any reply, and for good at an unsubscribe: `/api/unsubscribe` records the address in `suppressions`, which every send checks first.
- **Authentication** is the sending domain's: SPF and DKIM records for the mail provider, and a DMARC policy, set before the first email, since without them the messages land in spam or are refused.
- **Consent.** In the United States commercial email to a business address is allowed with an honest subject, an address and a working opt-out (CAN-SPAM). In the EU and the UK a first email to a company needs a legitimate interest, written down per account, and a named person's address needs more; the list holds companies and their published addresses only.
- **LinkedIn and Instagram** are written per account from the same evidence and sent by a person; no account is automated.

## Report after the first run

| Measure                        | Result                                                               |
| ------------------------------ | -------------------------------------------------------------------- |
| Answers citing the site        | 0 of 5: the site is not yet public, and the name is shared           |
| Accounts on the list           | 25 in the pilot, scored; 200 is the next pass                        |
| Emails sent, replies, meetings | none sent: the sending domain's records and a real sender come first |

Next iteration: publish the site, rewrite the first sentence of each answer to say whose WorkBot this is, measure a week later, extend the list to 200 from the pilot's criteria, and send the first 25 by hand from a domain with SPF, DKIM and DMARC in place.
