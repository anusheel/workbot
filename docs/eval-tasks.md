# Eval tasks

Two tasks for the fleet on Day 25, filed with `node scripts/fleet.mjs file docs/eval-tasks.md` and merged by its queue, which checks each batch with `pnpm check` and the smoke evals through the gate. The shape is that of `docs/fleet-tasks.md`: a goal, criteria an agent can check one by one, constraints, the files, and the test to write first.

## F-51 The eval gate in CI, and the nightly scoreboard

### Goal

Every pull request that touches a prompt, a tool, a model or an eval runs the smoke evals through the gate and gets the report as a comment; every night the full suite runs and its runs are recorded on the scoreboard.

### Acceptance criteria

- [ ] `.github/workflows/eval.yml` runs on `pull_request` when a changed file is one of `src/lib/system-prompt.ts`, `src/lib/tools.ts`, `src/lib/knowledge-tools.ts`, `src/lib/routing.ts`, `src/lib/providers.ts`, `src/lib/eval.ts`, `src/lib/eval-suite.ts`, `src/lib/eval-documents.ts`, `cli/eval.ts`, anything under `content/eval/` or `content/knowledge/`, or the workflow itself.
- [ ] That job installs with `pnpm install --frozen-lockfile`, runs `pnpm eval --task all --smoke --runs 2 --gate --report eval-report.md` with `ANTHROPIC_API_KEY` from the repository secret of that name and `DATABASE_URL=memory://`, and fails when the gate does: the step's exit code is the job's.
- [ ] The report is posted on the pull request as one comment that is updated on each run rather than added to (`gh pr comment --edit-last --create-if-none`, or the equivalent), whether the gate passed or failed; the job has `pull-requests: write` and no more.
- [ ] A second job runs on a nightly schedule and on `workflow_dispatch`: `pnpm eval --task all --runs 2 --record`, then commits `content/eval/scoreboard.jsonl` to `main` as the Actions bot with the subject "Record the nightly evals" when it changed; it has `contents: write` and no more.
- [ ] `scripts/agent-config.test.ts` gains a test, or a new `scripts/eval-workflow.test.ts` exists, that parses the workflow and checks the trigger paths above, the two commands, and that the smoke job's permissions hold only `pull-requests: write`.

### Constraints

Only `.github/workflows/eval.yml` and the test change. The commands and flags are the ones `cli/eval.ts` already takes; do not change it. Chrome is on `ubuntu-latest`, so the extraction documents render; ffmpeg is not needed. No third-party action beyond `actions/checkout`, `pnpm/action-setup` and `actions/setup-node`, as `ci.yml` uses them.

### Related code and docs

`.github/workflows/ci.yml` (the pattern), `cli/eval.ts` (the flags and the exit code), `src/lib/scoreboard.ts` (what a recorded run is), `AGENTS.md` (the commands).

### Test

The workflow test above: it fails before the workflow exists.

## F-52 Cite documents by path

### Goal

The golden cases require the source as the path the knowledge tools return, `faq/shipping-times.md`; the prompt's example shows a title, "(Expense reimbursement policy)", so the assistant names titles and loses the point: `pnpm eval --task chat --only find-cutoff-document --runs 1` scores 0.5 for that reason alone. Make the prompt ask for the path.

### Acceptance criteria

- [ ] The Sources paragraph of `src/lib/system-prompt.ts` asks for the document's path as the tools return it, with an example in that form, and says nothing else new.
- [ ] `pnpm eval --task chat --smoke --runs 2 --gate` passes.
- [ ] The pull request body reports the mean of `pnpm eval --task chat --runs 2` on `day-25` before the change and on the branch after it, both from `--record`, with the scoreboard lines in `content/eval/scoreboard.jsonl` committed.
- [ ] No golden case is edited.

### Constraints

Only `src/lib/system-prompt.ts` and `content/eval/scoreboard.jsonl` change. The prompt stays under 200 words. The seed in the `prompts` table is the file, so no migration.

### Related code and docs

`src/lib/system-prompt.ts`, `content/eval/golden.json` (the criteria that name paths), `cli/eval.ts`, `docs/routing.md` (the judge).

### Test

None to write: the gate is the test, and the two recorded means are the evidence.
