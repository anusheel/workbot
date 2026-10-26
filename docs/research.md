# Research: the runbook and the admin pages, as a customer's team meets them

A usability study of what WorkBot hands a customer: the runbook, the admin pages, the runbooks for incidents, the security documents and the cost estimate. The sessions in this round were run by agents, each given one role, one scripted task and only the repository; they test whether the documents can be followed by someone who did not write them, not what real people need. The plan below is the one to run with the customer's own people.

## Plan

**Who.** The people who receive WorkBot at a customer, one per session: the platform engineer who deploys it, the operations lead who runs it day to day, the security reviewer who approves it, the on-call engineer who answers its alerts, and the finance manager who approves its bill. Whoever runs the deployment also plays the customer's operations and platform teams in the interviews.

**The five tasks.**

1. Stand up staging in an empty Google Cloud project from the runbook, to the point where the app opens and the smoke suite passes.
2. Find out why a supplier's emailed invoice was never filed, and get it filed, from the admin pages.
3. Decide whether to approve WorkBot for a dental group whose conversations carry patient data, and on what conditions.
4. At 2 a.m., with model spend past its limit and answers slow, diagnose and stop the bleeding without taking the product down.
5. Work out the monthly cost at 1,000 users, what raises it, and which budget alert to set.

**Each session.** Sixty minutes on a call, the participant's screen shared, thinking aloud; the facilitator answers only "what would you do if I weren't here?". Outcome per task (completed, completed with difficulty, could not complete), every point of difficulty with its place and severity, and quotes.

**Consent, read at the start.** "We are testing our documents and pages, not you. We will record your screen and voice to take notes; the recording stays with our team, is deleted after 90 days, and nothing you say is attributed to you by name. You can stop at any time, and skip any question."

**Notes** live in the customer's project space, one page per session, named by role and date; quotes are kept word for word and attributed by role.

## Findings

Five sessions, one per role, each an agent given the role, the task and the repository, and nothing else. None could ask the team a question.

| Task                               | Role              | Outcome                   | Most severe point                                                |
| ---------------------------------- | ----------------- | ------------------------- | ---------------------------------------------------------------- |
| 1. Staging from an empty project   | platform engineer | completed with difficulty | no ordered sequence; secrets and DNS needed before the release   |
| 2. An invoice that was never filed | operations lead   | completed with difficulty | nothing says whether WorkBot reads email                         |
| 3. Approve for a dental group      | security reviewer | approve with conditions   | "yes" in the present tense for controls not yet applied          |
| 4. Spend past its limit at 2 a.m.  | on-call engineer  | plan with gaps            | no lever that holds spend without an outage                      |
| 5. The monthly budget              | finance manager   | approve with conditions   | what the $180 leaves out, and no alert for the recommended setup |

**Themes**, with the number of sessions that met each:

- **Written, or running? (3 of 5).** The documents mix what was proven on a running deployment with what is written and tested but not applied, in the same tense. "'Not been run' sits next to 'Yes, encrypted'. Which one am I buying?" (security reviewer).
- **Order and prerequisites left out (3 of 5).** The pieces were there, the sequence was not: a state bucket, service agents, secret values before services, DNS before the release, how to reach the first admin. "Nobody told me I needed DNS and a certificate first" (platform engineer).
- **The tool shows the what, not the which (2 of 5).** The inbox showed a time with no date; a dead letter did not name its document; the traces page cannot split spend by task or model. "The Inbox says 'Updated 14:32'. 14:32 on what day?" (operations lead).
- **A risk named without an action (2 of 5).** The outage runbook ended at "the risk is the bill"; the cost estimate named the add-ons without prices. "That's my problem, and it hands it back to the alert I'm already holding" (on-call engineer).
- **Agreements and commitments (2 of 5).** Which agreements cover which service, the breach-notification hours, the per-message charges.

**Changes**, each marked by where it is made:

| Finding                                          | Change                                                                                                                                           | Where         | Status  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------- |
| No ordered sequence from an empty project        | "Staging from an empty project" in infrastructure.md; the missing APIs added to Terraform                                                        | docs, code    | shipped |
| A missing document cannot be traced              | "A document that was not filed" in documents.md; dates in the inbox; the document's name on a dead letter                                        | docs, code    | shipped |
| Present tense for controls not yet applied       | The questionnaire says which controls run and which are written; the in-cloud model endpoint marked not built; breach-notification limits stated | docs          | shipped |
| What the $180 leaves out, and no alert           | A box under the recommendation: Twilio charges, staging, recovery, seats, two alerts                                                             | docs          | shipped |
| No runbook for spend running away                | The runbook, with what can and cannot be done today                                                                                              | docs          | shipped |
| No lever that holds spend                        | A daily dollar cap that turns the large-model fallback off                                                                                       | code          | backlog |
| The anonymous chat's limit is per instance       | A limit shared through Postgres                                                                                                                  | code          | backlog |
| Spend cannot be split by task or model on a page | Spend by task and model on `/admin/traces`                                                                                                       | code          | backlog |
| No single sign-on or second factor               | Sign-in through the customer's identity provider                                                                                                 | code          | backlog |
| Agent writes have no confirmation step           | A person's confirmation on writes that leave the system                                                                                          | code          | backlog |
| Viewers read every clinic's requests             | Scoping by team or location                                                                                                                      | configuration | backlog |
| Agreement coverage per service                   | A per-customer page of services, agreements, who signs, and status                                                                               | docs          | backlog |

The first three were the most severe in their sessions, and all three shipped the same day.
