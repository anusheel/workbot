import { parseArgs } from "node:util";
import { type Action, browse, chromeBrowser } from "@/lib/browser-agent";
import { chatModel } from "@/lib/chat";
import { close } from "@/lib/db";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { start: { type: "string" } },
});
const goal = positionals.join(" ").trim();
if (!goal || !values.start) {
  console.error('Usage: pnpm browse --start <url> "<what to do>"');
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

const browser = await chromeBrowser(values.start);
try {
  const result = await browse(goal, values.start, chatModel(), browser, {
    on: { step: (n, a) => console.log(dim(`${n}. ${describe(a)}: ${a.why}`)) },
  });
  console.log(
    `\n${result.outcome === "done" ? result.result : `${result.outcome}: ${result.result}`}`,
  );
} finally {
  await browser.close();
  await close();
}
