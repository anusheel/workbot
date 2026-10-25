import { stdout } from "node:process";
import { explain } from "@/lib/explainer";
import { asOperator } from "@/lib/tracing";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: pnpm explain "<the customer\'s question>"');
  process.exit(1);
}

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const started = Date.now();
const { approved, reply, trace, cost, turns } = await asOperator(
  "explain",
  () =>
    explain(question, {
      trace: ({ at, agent, event, tool, detail }) =>
        console.log(
          dim(
            `${((at.getTime() - started) / 1000).toFixed(1)}s ${agent} ${event} ${tool} ${detail}`,
          ),
        ),
      text: (text) => console.log(dim(`· ${text}`)),
    }),
);
stdout.write(`\n${reply}\n\n`);
if (!approved)
  console.log(
    "The editor did not approve this draft; a person finishes it before it is sent.",
  );
console.log(
  dim(`${trace.length} traced events, ${turns} turns, $${cost.toFixed(4)}`),
);
