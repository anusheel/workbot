# The fleet

Fifty tasks from the backlog, shipped by a fleet of coding agents in one afternoon: specified first, dispatched to worktrees on one laptop and to cloud sessions, each returned as a pull request that 4 reviewers, CI and a batched queue decided on. `scripts/fleet.mjs` runs it; `docs/fleet-tasks.md` holds the specifications; this page holds what happened and what it taught.

## The numbers

| What                                                                              | Count                                                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Tasks specified and filed                                                         | 50                                                                               |
| Merged, all of them                                                               | 50, over 2.4 hours from the first merge to the last: 20.6 an hour                |
| Lanes                                                                             | 25 in worktrees on one laptop, 25 in cloud sessions                              |
| Merged by the queue after an approving review                                     | 44                                                                               |
| Merged by a person after reading the review                                       | 6, each with the reason on the pull request                                      |
| Reviews written                                                                   | 52, by 4 reviewers each                                                          |
| Sent back with changes requested or a failed check, and fixed by a second session | 17 sessions, 11 of them then merged by the queue                                 |
| CI runs on fleet branches                                                         | 63: 59 passed, 4 failed                                                          |
| Reverted by a batch check, then reinstated                                        | 1                                                                                |
| Brief to merge                                                                    | median 101 minutes, 90th percentile 160                                          |
| Rounds of the loop                                                                | 15, each a dispatch, a batch of up to 6 reviews, the merges and a 3-minute check |
| Eval smoke subset per batch                                                       | 12 runs between 0.60 and 0.80 on a 0.5 bar                                       |
| Tests on the branch                                                               | 166 before, 276 after                                                            |

The count a fleet should not report is the first one: 50 merged says nothing about whether 50 was the right number. The brief-to-merge median says more: at 6 reviews a round and a 3-minute check, the queue, not the agents, set the pace.

## What the task shapes taught

**Shapes that merged on the first review.** A single library module and its test, with a gap the brief could name in one sentence and a test it could name in another: a cut-off response that must run no tool, a message that must always be kept, a driver that must send null. Thirty-three of the 50 merged on their first review; most of them were this shape.

**Shapes that needed a second session.**

- A fix that introduces its own problem. The trailing-dot fix (F-02) added a quadratic trim on a hostname that attacker-controlled input reaches; the performance and security reviewers measured it, the fix session replaced it with a linear loop. The brief asked for the right thing; the review is what made it safe.
- A brief that asks for a heuristic where the problem needs a mechanism. "Reject patterns that can hang the server" (F-05) with "no regex library" as a constraint: the first change caught the pattern in the brief and nothing else, and three reviewers showed the class cannot be closed by inspecting the pattern. The second session bounded the match with a timeout instead, inside the constraint. A better brief would have named the mechanism.
- A test that depends on the clock. The memory cap (F-15) asserted order on rows inserted in the same millisecond; it passed locally and failed in CI. The fix session gave the rows distinct times. A flaky test is fixed the day it appears, or the queue amplifies it.

**Shapes an agent cannot finish alone.**

- A task that edits the agent's own permissions. F-33 changes `.claude/settings.json`; a non-interactive session cannot write its own settings file, by design. The agent did the other 2 files, said exactly what remained, and stopped. A person made the last edit.

**Shapes that fail quietly.**

- A cloud agent that pushes to the branch its environment named rather than the one the brief named. Three naming schemes appeared in one afternoon; the collector learned all three. The brief should not name the branch at all: the dispatcher should read it from the session.

## What the queue taught

- A smoke eval is a gate against breakage, not against drift: one run of 5 cases on a small model scored 0.70, 0.65, 0.80 and 0.60 on batches that changed no prompt. The bar is 0.5.
- A review that requests changes needs a path back to an agent, and a head that was reviewed must not be reviewed again. Both were missing on the first round and added during the run.
- A failed check is a brief too: "CI failed on #n, read the run" was enough for a session to fix all 4.
- Batches amortise the check: 3 minutes of `pnpm check` per 6 pull requests rather than per one. A check can also fail for reasons outside the batch, as one did under the load of 6 fix sessions; the queue reverted an innocent change, which passed on its own and was reinstated. Keep the log of every check, and read it before re-dispatching.
- Two pull requests can each pass CI and still disagree: the configuration test from one task asserted the exact deny entry that another task's review had just changed. The hand merges at the end skipped the batch check, and the branch's full check found it.

## What a person did

Specified and reviewed the 50 before any agent started; finished one task an agent cannot (its own permissions file); read 7 reviews whose blocking items lay outside the brief and merged or reworded by hand; stopped the loop when the rest was judgment; reinstated one revert. About 2 hours of a person's attention over an afternoon, most of it reading reviews.

## The next backlog

- Name the test and the files; never name the branch.
- A constraint that rules out the only mechanism is a wrong constraint; say which mechanisms are allowed.
- Tasks that touch permissions, secrets or the CI workflow go to a person with an agent, not to the fleet.
- Keep the review fleet: it found 3 real problems the briefs did not anticipate, and it is the only part of the loop that reads the code.
