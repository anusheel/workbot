---
description: Review the current branch, or a pull request by number, with 3 reviewers in parallel (bugs, performance, security) and merge their findings into one review
---

The diff under review: `gh pr diff $ARGUMENTS` when a pull request number is given, otherwise `git diff main...HEAD`.

Run the `bug-hunter`, `performance-reviewer` and `security-reviewer` agents in parallel on that diff. Then write one review:

- Findings grouped by severity: blocking, should fix, nit. Each names its reviewer, file and line. Where 2 reviewers found the same thing, keep one entry.
- A verdict: approve, or request changes with the blocking items listed.

Do not add findings of your own; the reviewers are the review.
