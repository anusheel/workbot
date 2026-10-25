import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

type Yaml = string | Yaml[] | { [key: string]: Yaml };
type Step = {
  uses?: string;
  with?: Record<string, string>;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  "continue-on-error"?: string;
};
type Job = {
  if?: string;
  "timeout-minutes"?: string;
  concurrency?: Record<string, string>;
  permissions: Record<string, string>;
  steps: Step[];
};
type Workflow = {
  on: {
    pull_request: { paths: string[] };
    schedule: { cron: string }[];
    workflow_dispatch: string;
  };
  jobs: { smoke: Job; nightly: Job };
};

// The workflow uses a small subset of YAML (block mappings and sequences,
// plain or quoted scalars, `|` blocks, full-line comments), so no parser
// dependency is needed.
function parseYaml(source: string) {
  const lines = source.split("\n");
  let at = 0;
  const indentOf = (line: string) => line.length - line.trimStart().length;
  const skipBlank = () => {
    while (at < lines.length && /^\s*(#.*)?$/.test(lines[at])) at++;
  };
  const scalar = (text: string): Yaml =>
    text === "{}" ? {} : text.replace(/^(["'])(.*)\1$/, "$2");

  function blockScalar(parent: number) {
    const body: string[] = [];
    while (
      at < lines.length &&
      (!lines[at].trim() || indentOf(lines[at]) > parent)
    )
      body.push(lines[at++]);
    const indent = Math.min(
      ...body.filter((line) => line.trim()).map(indentOf),
    );
    return body
      .map((line) => line.slice(indent))
      .join("\n")
      .trim();
  }

  function sequence(indent: number): Yaml[] {
    const items: Yaml[] = [];
    for (skipBlank(); at < lines.length; skipBlank()) {
      const line = lines[at];
      if (indentOf(line) !== indent || !line.trimStart().startsWith("- "))
        break;
      const content = line.trimStart().slice(2);
      if (/^[\w"-]+:(\s|$)/.test(content)) {
        // `- key: value` opens a mapping whose other keys sit under the key.
        lines[at] = " ".repeat(indent + 2) + content;
        items.push(mapping(indent + 2));
      } else {
        at++;
        items.push(scalar(content));
      }
    }
    return items;
  }

  function mapping(indent: number): Yaml {
    const entries: Record<string, Yaml> = {};
    for (skipBlank(); at < lines.length; skipBlank()) {
      const line = lines[at];
      const entry = line.trimStart().match(/^([^\s:][^:]*?):(?:\s+(.*))?$/);
      if (indentOf(line) !== indent || !entry) break;
      const [, key, value = ""] = entry;
      at++;
      if (value.startsWith("|")) {
        entries[key] = blockScalar(indent);
      } else if (value) {
        entries[key] = scalar(value);
      } else {
        skipBlank();
        const next = lines[at];
        entries[key] =
          next === undefined || indentOf(next) < indent
            ? ""
            : indentOf(next) === indent
              ? next.trimStart().startsWith("- ")
                ? sequence(indent)
                : ""
              : next.trimStart().startsWith("- ")
                ? sequence(indentOf(next))
                : mapping(indentOf(next));
      }
    }
    return entries;
  }

  skipBlank();
  return mapping(0) as unknown as Workflow;
}

const workflow = parseYaml(
  readFileSync(
    new URL("../.github/workflows/eval.yml", import.meta.url),
    "utf8",
  ),
);
const { smoke, nightly } = workflow.jobs;
const commands = (job: Job) => job.steps.flatMap((step) => step.run ?? []);

const root = fileURLToPath(new URL("..", import.meta.url));
const { paths } = workflow.on.pull_request;
const covered = (file: string) =>
  paths.some((path) =>
    path.endsWith("/**") ? file.startsWith(path.slice(0, -2)) : file === path,
  );

/** Every module `entry` imports, directly or not, as a path from the root. */
function modulesRun(entry: string) {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(join(root, file), "utf8");
    for (const [, spec] of source.matchAll(
      /(?:from|import\()\s*["']([^"']+)["']/g,
    )) {
      const base = spec.startsWith("@/")
        ? join("src", spec.slice(2))
        : spec.startsWith(".")
          ? join(dirname(file), spec)
          : undefined;
      if (!base) continue;
      const next = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find(
        (candidate) => existsSync(join(root, candidate)),
      );
      if (next) visit(next);
    }
  };
  visit(entry);
  return [...seen].sort();
}

test("a pull request runs the smoke evals when a prompt, tool, model, eval or the workflow changes", () => {
  // The first twelve are the brief's; the rest are modules the evals run that
  // carry a prompt, a schema or a score, the dependencies that shape a call, and
  // the customer file the prompts are functions of.
  expect(paths).toEqual([
    "src/lib/system-prompt.ts",
    "src/lib/tools.ts",
    "src/lib/knowledge-tools.ts",
    "src/lib/routing.ts",
    "src/lib/providers.ts",
    "src/lib/eval.ts",
    "src/lib/eval-suite.ts",
    "src/lib/eval-documents.ts",
    "cli/eval.ts",
    "content/eval/**",
    "content/knowledge/**",
    ".github/workflows/eval.yml",
    "src/lib/intake.ts",
    "src/lib/extract.ts",
    "src/lib/documents.ts",
    "src/lib/document-model.ts",
    "src/lib/request-model.ts",
    "src/lib/field-match.ts",
    "src/lib/chat.ts",
    "src/lib/knowledge.ts",
    "src/lib/web.ts",
    "src/lib/prompts.ts",
    "src/lib/customer.ts",
    "src/lib/github.ts",
    "src/lib/unified.ts",
    "src/lib/rules.ts",
    "content/rules.rules",
    "content/customers/**",
    "content/defaults.json",
    "src/lib/settings.ts",
    "package.json",
    "pnpm-lock.yaml",
  ]);
  expect(smoke.if).toBe(
    "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository",
  );
});

test("a module the evals run is a trigger path unless it holds no prompt, tool, schema or score", () => {
  // Plumbing that only stores, configures, measures or does sums, with tests of
  // its own. A module the evals come to import that is in neither list fails
  // here, and a person decides which.
  const plumbing = new Set([
    "src/lib/cache.ts",
    "src/lib/calculator.ts",
    "src/lib/config.ts",
    "src/lib/db.ts",
    "src/lib/embeddings.ts",
    "src/lib/entities/tables.ts",
    "src/lib/format.ts",
    "src/lib/mcp.ts",
    "src/lib/notes.ts",
    "src/lib/requests.ts",
    "src/lib/rule-language.ts",
    "src/lib/schema.ts",
    "src/lib/scoreboard.ts",
    "src/lib/tickets.ts",
    "src/lib/tool.ts",
    "src/lib/tracing.ts",
  ]);
  const unlisted = modulesRun("cli/eval.ts").filter(
    (file) => !covered(file) && !plumbing.has(file),
  );
  expect(unlisted).toEqual([]);
});

test("the smoke job installs frozen and runs the gate on the secret key and an in-memory database", () => {
  expect(commands(smoke)).toContain("pnpm install --frozen-lockfile");
  expect(commands(smoke)).toContain(
    "pnpm eval --task all --smoke --runs 2 --gate --report eval-report.md",
  );
  const gate = smoke.steps.find((step) => step.run?.includes("--gate"));
  expect(gate?.env).toEqual({
    ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_API_KEY }}",
    DATABASE_URL: "memory://",
  });
  // The gate's exit code has to be the job's.
  expect(gate?.["continue-on-error"]).toBeUndefined();
});

test("the report is one comment, edited on each run, whether the gate passed or failed", () => {
  const comment = smoke.steps.find((step) =>
    step.run?.includes("gh pr comment"),
  );
  expect(comment?.run).toContain("--edit-last --create-if-none");
  expect(comment?.run).toContain("--body-file eval-report.md");
  // Not `always()`: a run that a newer push cancelled must not comment over it.
  expect(comment?.if).toBe("${{ !cancelled() }}");
  expect(comment?.env?.GH_TOKEN).toBe("${{ github.token }}");
});

test("a run that crashed before it wrote a report replaces the last commit's report with a note", () => {
  const comment = smoke.steps.find((step) =>
    step.run?.includes("gh pr comment"),
  );
  const script = comment?.run ?? "";
  expect(script).toContain("[ -f eval-report.md ] || echo");
  expect(script.indexOf("[ -f eval-report.md ]")).toBeLessThan(
    script.indexOf("gh pr comment"),
  );
});

test("the smoke job can write pull requests and nothing else", () => {
  expect(smoke.permissions).toEqual({ "pull-requests": "write" });
});

test("every night, and on demand from main, the full suite is recorded and the scoreboard committed to main", () => {
  expect(workflow.on.schedule).toHaveLength(1);
  expect(workflow.on.schedule[0].cron).toMatch(/^\S+( \S+){4}$/);
  expect(workflow.on).toHaveProperty("workflow_dispatch");
  // A dispatch from another branch would run that branch's workflow file with
  // the key and the write token.
  expect(nightly.if).toBe(
    "github.event_name == 'schedule' || github.ref == 'refs/heads/main'",
  );
  const checkout = nightly.steps.find((step) =>
    step.uses?.startsWith("actions/checkout"),
  );
  expect(checkout?.with?.ref).toBe("main");
  expect(commands(nightly)).toContain("pnpm install --frozen-lockfile");
  const evals = nightly.steps.find((step) => step.run?.includes("pnpm eval"));
  expect(evals?.run).toBe("pnpm eval --task all --runs 2 --record");
  expect(evals?.env).toEqual({
    ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_API_KEY }}",
    DATABASE_URL: "memory://",
  });
  expect(nightly.permissions).toEqual({ contents: "write" });
});

test("the nightly commits the scoreboard only when it changed, as the bot, on top of whatever landed on main", () => {
  const commit = commands(nightly).join("\n");
  expect(commit).toContain("git add content/eval/scoreboard.jsonl");
  // A night with nothing to record must not fail the job.
  expect(commit).toContain("git diff --cached --quiet ||");
  expect(commit).toContain('git config user.name "github-actions[bot]"');
  expect(commit).toContain('git commit -m "Record the nightly evals"');
  // The run takes minutes, so main has moved by the time it pushes.
  expect(commit).toContain("git pull --rebase origin main");
  expect(commit.indexOf("git pull --rebase origin main")).toBeLessThan(
    commit.indexOf("git push origin HEAD:main"),
  );
});

test("the write token reaches git in the last step only, not the install and the evals", () => {
  const checkout = nightly.steps.find((step) =>
    step.uses?.startsWith("actions/checkout"),
  );
  expect(checkout?.with?.["persist-credentials"]).toBe("false");
  const withToken = nightly.steps.filter((step) =>
    JSON.stringify(step).includes("github.token"),
  );
  expect(withToken).toEqual([nightly.steps.at(-1)]);
  const smokeCheckout = smoke.steps.find((step) =>
    step.uses?.startsWith("actions/checkout"),
  );
  expect(smokeCheckout?.with?.["persist-credentials"]).toBe("false");
});

test("a hung call or an overlapping run cannot hold the runner, the key or the write token", () => {
  expect(smoke["timeout-minutes"]).toBe("15");
  expect(nightly["timeout-minutes"]).toBe("45");
  // A newer push replaces the older gate; two nightlies queue rather than race.
  expect(smoke.concurrency).toEqual({
    group: "eval-smoke-${{ github.ref }}",
    "cancel-in-progress": "true",
  });
  expect(nightly.concurrency).toEqual({
    group: "eval-nightly",
    "cancel-in-progress": "false",
  });
});

test("the workflow uses no action beyond checkout, pnpm and node setup", () => {
  const used = Object.values(workflow.jobs)
    .flatMap((job) => job.steps)
    .flatMap((step) => step.uses ?? [])
    .map((action) => action.split("@")[0]);
  expect(new Set(used)).toEqual(
    new Set(["actions/checkout", "pnpm/action-setup", "actions/setup-node"]),
  );
});
