import { parseArgs } from "node:util";
import { type Action, browse, chromeBrowser } from "@/lib/browser-agent";
import { modelFor } from "@/lib/routing";
import { close } from "@/lib/db";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { start: { type: "string" }, help: { type: "boolean" } },
});

// Exit codes: 0 done, 1 bad usage, 2 the agent gave up, 3 the step limit.
const usage = `Usage: pnpm browse --start <url> "<what to do>"

--start must be an absolute http, https or file URL.

Exit codes:
  0  the task is done
  1  bad usage or an invalid --start
  2  the agent gave up
  3  the step limit was reached`;

if (values.help) {
  console.log(usage);
  process.exit(0);
}

const goal = positionals.join(" ").trim();
if (!goal || !values.start) {
  console.error(usage);
  process.exit(1);
}

const startable = (value: string) => {
  try {
    return ["http:", "https:", "file:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
if (!startable(values.start)) {
  console.error(
    `--start must be an absolute http(s) or file URL, got "${values.start}".`,
  );
  process.exit(1);
}

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const describe = (a: Action) =>
  a.kind === "click"
    ? `click ${a.x},${a.y}`
    : a.kind === "type"
      ? `type "${a.text}"`
      : a.kind === "scroll"
        ? `scroll ${a.dy}`
        : a.kind === "goto"
          ? `goto ${a.url}`
          : a.kind;

const exitCodes = { done: 0, gave_up: 2, steps: 3 } as const;

const browser = await chromeBrowser(values.start);
try {
  const result = await browse(
    goal,
    values.start,
    modelFor("research"),
    browser,
    {
      on: {
        step: (n, a) => console.log(dim(`${n}. ${describe(a)}: ${a.why}`)),
      },
    },
  );
  console.log(
    `\n${result.outcome === "done" ? result.result : `${result.outcome}: ${result.result}`}`,
  );
  process.exitCode = exitCodes[result.outcome];
} finally {
  await browser.close();
  await close();
}
