#!/usr/bin/env node
// A fleet of coding agents on the backlog. The tasks are issues; each agent
// works one, in a worktree here or in a cloud session, and its change comes
// back as a pull request against the day's branch; the queue reviews and
// merges them in batches, checks the branch after each batch, and reverts what
// broke it.
//   node scripts/fleet.mjs file <tasks.md>                  one issue per `## ` section
//   node scripts/fleet.mjs dispatch [--local 5] [--cloud 10]  agents for queued issues
//   node scripts/fleet.mjs status                           the dashboard
//   node scripts/fleet.mjs merge [--batch 6]                review, merge, check, revert
//   node scripts/fleet.mjs report                           merged an hour, reverts, brief to merge
//   node scripts/fleet.mjs reset <issue>                    forget a run so dispatch retries it
//   node scripts/fleet.mjs run [the same flags]             dispatch, merge and report every 2 minutes until done
import { execFile, execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";

const LABEL = "fleet";
const TOOLS =
  "Edit,Write,Read,Glob,Grep,Bash(pnpm:*),Bash(git:*),Bash(gh pr create:*),Bash(gh pr view:*),Bash(gh pr comment:*),Bash(gh pr edit:*),Bash(gh pr checks:*),Bash(gh run view:*),Bash(gh issue view:*)";
const NO_MCP = ["--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'];
const home = resolve(import.meta.dirname, "..");
const pens = join(home, "..", "workbot-fleet");
const stateFile = join(home, ".fleet.json");

const sh = (cmd, args, options = {}) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    cwd: home,
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  }).trim();
const gh = (...args) => sh("gh", args);
const ghJson = (...args) => JSON.parse(gh(...args));
const runs = () =>
  existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
const save = (state) =>
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const minutes = (since) => Math.round((Date.now() - Date.parse(since)) / 6e4);
const branchOf = (issue) => `fleet/${issue.number}`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    local: { type: "string", default: "5" },
    cloud: { type: "string", default: "10" },
    batch: { type: "string", default: "6" },
    base: { type: "string", default: sh("git", ["branch", "--show-current"]) },
  },
});
const base = values.base;

// One issue per task, the task's body as the issue's; the label is how the fleet finds them.
function file(path) {
  gh(
    "label",
    "create",
    LABEL,
    "--force",
    "--color",
    "5319E7",
    "--description",
    "A task for the fleet",
  );
  for (const section of readFileSync(path, "utf8").split(/^## /m).slice(1)) {
    const [title, ...body] = section.split("\n");
    console.log(
      gh(
        "issue",
        "create",
        "--label",
        LABEL,
        "--title",
        title.trim(),
        "--body",
        body.join("\n").trim(),
      ),
    );
  }
}

// Only a maintainer's issues and pull requests are the fleet's: anyone can file
// an issue or name one in a pull request on a public repository.
const maintainers = () =>
  new Set(
    ghJson("api", "repos/{owner}/{repo}/collaborators", "--jq", "[.[].login]"),
  );

function tasks() {
  const issues = ghJson(
    "issue",
    "list",
    "--label",
    LABEL,
    "--state",
    "all",
    "--limit",
    "100",
    "--json",
    "number,title,createdAt,author",
  );
  const prs = ghJson(
    "pr",
    "list",
    "--base",
    base,
    "--state",
    "all",
    "--limit",
    "100",
    "--json",
    "number,body,state,mergedAt,statusCheckRollup,headRefOid,author",
  );
  const state = runs();
  const rank = { MERGED: 0, OPEN: 1, CLOSED: 2 };
  const team = maintainers();
  const ours = ({ author }) => team.has(author.login);
  return issues
    .filter(ours)
    .sort((a, b) => a.number - b.number)
    .map((issue) => ({
      issue,
      run: state[issue.number],
      pr: prs
        .filter(
          (pr) =>
            ours(pr) &&
            new RegExp(`closes #${issue.number}\\b`, "i").test(pr.body),
        )
        .sort((a, b) => rank[a.state] - rank[b.state])[0],
    }));
}

function ci(pr) {
  const checks = pr.statusCheckRollup ?? [];
  if (
    checks.some((c) =>
      ["FAILURE", "CANCELLED", "TIMED_OUT"].includes(c.conclusion),
    )
  )
    return "fail";
  if (
    checks.length &&
    checks.every(
      (c) =>
        c.status === "COMPLETED" &&
        ["SUCCESS", "SKIPPED"].includes(c.conclusion),
    )
  )
    return "pass";
  return "pending";
}

function stage({ pr, run }) {
  if (pr?.state === "MERGED") return "merged";
  if (pr?.state === "OPEN" && run?.fixing && alive(run.pid))
    return `fixing pr #${pr.number}, ${minutes(run.started)} min`;
  if (pr?.state === "OPEN") return `pr #${pr.number}, ci ${ci(pr)}`;
  if (pr) return `pr #${pr.number} closed`;
  if (run?.cloud) return `cloud, ${minutes(run.started)} min, no branch yet`;
  if (run && alive(run.pid)) return `local, ${minutes(run.started)} min`;
  if (run) return "failed: no pull request";
  return "queued";
}

const brief = (
  issue,
) => `Implement issue #${issue.number} on branch ${branchOf(issue)} from ${base}. Read it with \`gh issue view ${issue.number}\` and follow AGENTS.md.
Write the test the issue names first and see it fail; then make the smallest change that meets every criterion and nothing the issue did not ask for. Run \`pnpm lint\`, \`pnpm typecheck\` and \`pnpm exec vitest run <the test files you touched>\` until they pass.
Commit once, with an imperative subject under 60 characters and a body that says what changed and why and ends with \`Closes #${issue.number}\`. Push the branch.`;

const localBrief = (
  issue,
  session,
) => `${brief(issue)} Then open the pull request with \`gh pr create --base ${base} --title "<the subject>" --body-file <a file with this content>\`:
## Brief
Closes #${issue.number}
## Plan
<the commit body>
## Session
- Claude Code: ${session}
## Checks
- [x] \`pnpm lint\`, \`pnpm typecheck\` and the touched tests pass; \`pnpm check\` runs in CI
Stop when the pull request exists.`;

const cloudBrief = (issue) =>
  `This is a fresh clone: run \`pnpm install --frozen-lockfile\` first (\`corepack enable\` if pnpm is missing), then \`git switch -c ${branchOf(issue)}\`. ${brief(issue)} The pull request is opened for you once the branch is on GitHub; stop after the push.`;

// A worktree and a branch of its own, the dependencies, and a Claude Code
// session in the background with the brief; the log sits beside the worktree.
function startLocal(issue) {
  const dir = join(pens, String(issue.number));
  mkdirSync(pens, { recursive: true });
  sh("git", ["worktree", "add", "-q", "-B", branchOf(issue), dir, base]);
  sh("pnpm", ["install", "--frozen-lockfile", "--silent"], { cwd: dir });
  const session = randomUUID();
  const log = openSync(join(pens, `${issue.number}.log`), "w");
  const child = spawn(
    "claude",
    [
      "-p",
      localBrief(issue, session),
      "--model",
      "sonnet",
      "--session-id",
      session,
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      TOOLS,
      ...NO_MCP,
    ],
    { cwd: dir, stdio: ["ignore", log, log], detached: true },
  );
  child.unref();
  console.log(`#${issue.number} ${issue.title}: local, pid ${child.pid}`);
  return { pid: child.pid, started: new Date().toISOString(), session };
}

// A cloud session clones the branch this checkout is on; the CLI wants a
// terminal, so it gets a pseudo one, in the form `script` takes on each platform.
function startCloud(issue) {
  const command = ["claude", "--cloud", cloudBrief(issue), "--model", "sonnet"];
  const quoted = command
    .map((arg) => `'${arg.replaceAll("'", "'\\''")}'`)
    .join(" ");
  const out =
    process.platform === "darwin"
      ? sh("script", ["-q", "/dev/null", ...command])
      : sh("script", ["-q", "-c", quoted, "/dev/null"]);
  const cloud = out.match(/session_[A-Za-z0-9]+/)?.[0];
  if (!cloud) throw new Error(`no cloud session for #${issue.number}: ${out}`);
  console.log(`#${issue.number} ${issue.title}: cloud, ${cloud}`);
  return { cloud, started: new Date().toISOString() };
}

const fixBrief = (
  issue,
  why,
  session,
  branch,
) => `The pull request for issue #${issue.number} (branch ${branch}, checked out here) cannot merge yet; below is why: a review that requests changes, or a failed check. Address every blocking item, and the should-fix items where the change is small; keep every criterion of the issue met. If a blocking item cannot be fixed within the issue's constraints, say so in a comment on the pull request (\`gh pr comment\`) and stop. Run \`pnpm lint\`, \`pnpm typecheck\` and the tests you touched until they pass, commit (a new commit, imperative subject), push, and add the line "- Claude Code (fix): ${session}" under Session in the pull request body with \`gh pr edit --body-file\`.

${why}`;

// A review that requests changes, or a failed check, goes back to an agent,
// once: a session on the pull request's branch, in the task's worktree or a
// new one for a cloud branch.
function startFix(issue, why, branch = branchOf(issue)) {
  const dir = join(pens, String(issue.number));
  if (existsSync(dir)) sh("git", ["pull", "-q", "--ff-only"], { cwd: dir });
  else {
    sh("git", ["fetch", "-q", "origin", branch]);
    sh("git", ["worktree", "add", "-q", dir, branch]);
    sh("pnpm", ["install", "--frozen-lockfile", "--silent"], { cwd: dir });
  }
  const session = randomUUID();
  const log = openSync(join(pens, `${issue.number}-fix.log`), "w");
  const child = spawn(
    "claude",
    [
      "-p",
      fixBrief(issue, why, session, branch),
      "--model",
      "sonnet",
      "--session-id",
      session,
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      TOOLS,
      ...NO_MCP,
    ],
    { cwd: dir, stdio: ["ignore", log, log], detached: true },
  );
  child.unref();
  console.log(`#${issue.number}: fix session, pid ${child.pid}`);
  return {
    pid: child.pid,
    started: new Date().toISOString(),
    session,
    fixing: true,
  };
}

// A cloud agent pushes its branch but holds no GitHub token; the pull request
// is opened here, with the agent's commit message and the session link. The
// branch may carry the name the brief gave or one the cloud chose at start.
function collect(state) {
  for (const { issue, run, pr } of tasks()) {
    if (!run?.cloud || pr) continue;
    const head = sh("git", [
      "ls-remote",
      "--heads",
      "origin",
      branchOf(issue),
      `claude/fleet-${issue.number}-*`,
      `claude/issue-${issue.number}-*`,
    ])
      .split("\n")
      .find(Boolean)
      ?.split("refs/heads/")[1];
    if (!head) continue;
    sh("git", ["fetch", "-q", "origin", head]);
    const [subject, ...body] = sh("git", [
      "log",
      "-1",
      "--format=%s%n%b",
      `origin/${head}`,
    ]).split("\n");
    const plan = body
      .join("\n")
      .split(/^Closes #/m)[0]
      .trim();
    const text = `## Brief\nCloses #${issue.number}\n## Plan\n${plan}\n## Session\n- Claude Code: https://claude.ai/code/${run.cloud}\n## Checks\n- [ ] \`pnpm check\` runs in CI`;
    console.log(
      gh(
        "pr",
        "create",
        "--base",
        base,
        "--head",
        head,
        "--title",
        subject,
        "--body",
        text,
      ),
    );
    Object.assign(state[issue.number], { collected: true, branch: head });
  }
}

function dispatch({ local, cloud }) {
  const state = runs();
  collect(state);
  const slots = {
    local:
      local -
      Object.values(state).filter((run) => run.pid && alive(run.pid)).length,
    cloud:
      cloud -
      Object.values(state).filter((run) => run.cloud && !run.collected).length,
  };
  for (const { issue, pr, run } of tasks()) {
    if (pr || run) continue;
    const lane = slots.local > 0 ? "local" : slots.cloud > 0 ? "cloud" : null;
    if (!lane) break;
    try {
      state[issue.number] =
        lane === "local" ? startLocal(issue) : startCloud(issue);
      slots[lane]--;
    } catch (error) {
      console.error(`#${issue.number}: not started, ${error.message}`);
    }
  }
  save(state);
}

function reset(number) {
  const state = runs();
  if (existsSync(join(pens, String(number))))
    sh("git", ["worktree", "remove", "--force", join(pens, String(number))]);
  delete state[number];
  save(state);
}

function status() {
  const rows = tasks().map(({ issue, pr, run }) => [
    `#${issue.number}`,
    issue.title.slice(0, 56),
    stage({ pr, run }),
  ]);
  if (!rows.length) return console.log("no tasks filed");
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map((row) => row[i].length)),
  );
  for (const row of rows)
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join("  "));
  const counts = Object.groupBy(rows, (row) => row[2].split(/[ ,:]/)[0]);
  console.log(
    Object.entries(counts)
      .map(([name, group]) => `${group.length} ${name}`)
      .join(", "),
  );
}

// The review skill with its 4 reviewers, in the main checkout, on the pull request.
const review = (pr) =>
  promisify(execFile)(
    "claude",
    [
      "-p",
      `/review ${pr.number}`,
      "--model",
      "sonnet",
      "--allowedTools",
      "Read,Grep,Glob,Agent,Task,Bash(gh pr:*),Bash(gh issue view:*),Bash(git diff:*)",
      "--output-format",
      "json",
      ...NO_MCP,
    ],
    { cwd: home, encoding: "utf8", maxBuffer: 16 * 2 ** 20 },
  ).then(({ stdout }) => JSON.parse(stdout).result.trim());

// Green on the branch: the full check, then the eval smoke subset on the small
// model; the bar is low because the subset catches a broken assistant, not
// drift. True when green, otherwise the path of the log that says why.
function green() {
  const path = join(pens, `check-${Date.now()}.log`);
  const log = openSync(path, "w");
  try {
    execFileSync("pnpm", ["check"], { cwd: home, stdio: ["ignore", log, log] });
  } catch {
    return path;
  }
  const mean = Number(
    sh("pnpm", ["eval", "--runs", "1", "--only", "answer"]).match(
      /Mean (\d\.\d+)/,
    )?.[1],
  );
  console.log(`eval smoke: mean ${mean}`);
  return mean >= 0.5 || path;
}

// Review the ready pull requests together, merge the approved ones one at a
// time with the agent's commit message, then check the branch; what broke it
// is reverted, last in first out by its merge commit, and its issue reopened.
async function merge(batch) {
  const state = runs();
  const ready = tasks()
    .filter(
      ({ pr, run }) =>
        pr?.state === "OPEN" &&
        ci(pr) === "pass" &&
        run?.reviewed !== pr.headRefOid,
    )
    .slice(0, batch);
  const reviews = await Promise.all(ready.map(({ pr }) => review(pr)));
  const merged = [];
  for (const [i, { issue, pr, run }] of ready.entries()) {
    execFileSync(
      "gh",
      ["pr", "comment", String(pr.number), "--body-file", "-"],
      { cwd: home, input: reviews[i] },
    );
    const verdict = reviews[i].trim().split("\n").at(-1) ?? "";
    if (!verdict.startsWith("Verdict:")) {
      console.log(`#${pr.number}: no verdict in the review, again next round`);
      continue;
    }
    state[issue.number] = { ...run, reviewed: pr.headRefOid };
    if (verdict !== "Verdict: approve") {
      console.log(`#${pr.number}: changes requested`);
      if (!run?.fixing)
        state[issue.number] = {
          ...startFix(issue, reviews[i], run?.branch),
          reviewed: pr.headRefOid,
        };
      continue;
    }
    const now = ghJson(
      "pr",
      "view",
      String(pr.number),
      "--json",
      "commits,headRefOid,statusCheckRollup",
    );
    if (now.headRefOid !== pr.headRefOid || ci(now) !== "pass") {
      console.log(`#${pr.number}: changed since the review, again next round`);
      continue;
    }
    const [commit] = now.commits;
    gh(
      "pr",
      "merge",
      String(pr.number),
      "--squash",
      "--subject",
      commit.messageHeadline,
      "--body",
      commit.messageBody,
    );
    const { mergeCommit } = ghJson(
      "pr",
      "view",
      String(pr.number),
      "--json",
      "mergeCommit",
    );
    merged.push({ issue, sha: mergeCommit.oid });
    console.log(`#${pr.number}: merged`);
  }
  for (const { issue, pr, run } of tasks()) {
    if (
      pr?.state !== "OPEN" ||
      ci(pr) !== "fail" ||
      run?.fixing ||
      run?.reviewed === pr.headRefOid
    )
      continue;
    const why = `CI failed on pull request #${pr.number}: \`gh pr checks ${pr.number}\` names the run, \`gh run view <id> --log-failed\` shows the failure.`;
    state[issue.number] = {
      ...startFix(issue, why, run?.branch),
      reviewed: pr.headRefOid,
    };
  }
  save(state);
  if (!merged.length) return;
  sh("git", ["pull", "-q", "--ff-only"]);
  for (const { issue, sha } of merged.reverse()) {
    const failed = green();
    if (failed === true) break;
    const lines = readFileSync(failed, "utf8")
      .split("\n")
      .filter((line) => /FAIL|error|×|✗/.test(line))
      .slice(-8)
      .join("\n");
    sh("git", ["revert", "--no-edit", sha]);
    gh(
      "issue",
      "reopen",
      String(issue.number),
      "--comment",
      `Reverted: the branch failed its checks with this change. The brief needs a look.\n\n\`\`\`\n${lines}\n\`\`\``,
    );
    console.log(`#${issue.number}: reverted`);
  }
  sh("git", ["push", "-q"]);
}

function report() {
  const done = tasks()
    .filter(({ pr }) => pr?.state === "MERGED")
    .sort((a, b) => Date.parse(a.pr.mergedAt) - Date.parse(b.pr.mergedAt));
  if (!done.length) return console.log("nothing merged yet");
  const hours = Math.max(
    (Date.parse(done.at(-1).pr.mergedAt) - Date.parse(done[0].pr.mergedAt)) /
      36e5,
    1 / 60,
  );
  const toMerge = done
    .map(
      ({ issue, pr }) =>
        (Date.parse(pr.mergedAt) - Date.parse(issue.createdAt)) / 6e4,
    )
    .sort((a, b) => a - b);
  const at = (q) =>
    toMerge[
      Math.min(toMerge.length - 1, Math.floor(toMerge.length * q))
    ].toFixed(0);
  const reverts = sh("git", ["log", base, "--format=%s", "--grep", "^Revert "])
    .split("\n")
    .filter(Boolean).length;
  console.log(
    `${done.length} merged over ${hours.toFixed(1)} h, ${(done.length / hours).toFixed(1)} an hour; ${reverts} reverted; brief to merge: median ${at(0.5)} min, p90 ${at(0.9)} min`,
  );
}

// The whole day in one command: fill the slots, merge what is ready, show the board, repeat.
async function run(options) {
  for (;;) {
    try {
      dispatch(options);
      await merge(options.batch);
    } catch (error) {
      console.error(`this round: ${error.message}`);
    }
    status();
    const left = tasks().filter(({ pr }) => pr?.state !== "MERGED");
    if (!left.length) return report();
    await new Promise((resolve) => setTimeout(resolve, 120_000));
  }
}

const [command, arg] = positionals;
switch (command) {
  case "file":
    file(arg);
    break;
  case "dispatch":
    dispatch({ local: Number(values.local), cloud: Number(values.cloud) });
    break;
  case "status":
    status();
    break;
  case "merge":
    await merge(Number(values.batch));
    break;
  case "report":
    report();
    break;
  case "run":
    await run({
      local: Number(values.local),
      cloud: Number(values.cloud),
      batch: Number(values.batch),
    });
    break;
  case "reset":
    reset(Number(arg));
    break;
  default:
    console.error(
      "usage: node scripts/fleet.mjs file <tasks.md> | dispatch [--local n] [--cloud n] | status | merge [--batch n] | report | reset <issue> | run",
    );
    process.exit(1);
}
