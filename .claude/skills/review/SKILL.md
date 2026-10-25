---
name: review
description: Review the current branch, or a pull request by number, with 4 reviewers in parallel (bugs, performance, security, the brief) and merge their findings into one review
argument-hint: [pr-number]
---

The diff under review: `gh pr diff $ARGUMENTS` when a pull request number is given, otherwise `git diff main...HEAD`.

Run the `bug-hunter`, `performance-reviewer` and `security-reviewer` agents in parallel on that diff, and `brief-reviewer` when the pull request closes an issue. Then write one review:

- Findings grouped by severity: blocking, should fix, nit. Each names its reviewer, file and line. Where 2 reviewers found the same thing, keep one entry.
- The brief: each criterion met and tested, met but untested, or not met, when a brief reviewer ran.
- The last line is the verdict, `Verdict: approve` or `Verdict: request changes`, with the blocking items listed above it. An unmet criterion is blocking.

Do not add findings of your own; the reviewers are the review.
