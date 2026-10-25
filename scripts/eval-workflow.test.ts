import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

type Yaml = string | Yaml[] | { [key: string]: Yaml };
type Step = {
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  "continue-on-error"?: string;
};
type Job = {
  if?: string;
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

test("a pull request runs the smoke evals when a prompt, tool, model, eval or the workflow changes", () => {
  expect(workflow.on.pull_request.paths).toEqual([
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
  ]);
  expect(smoke.if).toBe("github.event_name == 'pull_request'");
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
  expect(comment?.if).toContain("always()");
  expect(comment?.env?.GH_TOKEN).toBe("${{ github.token }}");
});

test("the smoke job can write pull requests and nothing else", () => {
  expect(smoke.permissions).toEqual({ "pull-requests": "write" });
});

test("every night, and on demand, the full suite is recorded and the scoreboard committed to main", () => {
  expect(workflow.on.schedule).toHaveLength(1);
  expect(workflow.on.schedule[0].cron).toMatch(/^\S+( \S+){4}$/);
  expect(workflow.on).toHaveProperty("workflow_dispatch");
  expect(nightly.if).toBe("github.event_name != 'pull_request'");
  expect(commands(nightly)).toContain("pnpm install --frozen-lockfile");
  expect(commands(nightly)).toContain("pnpm eval --task all --runs 2 --record");
  const commit = commands(nightly).join("\n");
  expect(commit).toContain("content/eval/scoreboard.jsonl");
  expect(commit).toContain('git commit -m "Record the nightly evals"');
  expect(commit).toContain("git push origin HEAD:main");
  expect(commit).toContain("github-actions[bot]");
  expect(nightly.permissions).toEqual({ contents: "write" });
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
