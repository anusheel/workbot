import { parseArgs } from "node:util";
import { close } from "@/lib/db";
import { modelFor } from "@/lib/routing";
import { approve, dryRun, proposeRule } from "@/lib/rule-proposal";
import { customerRulesFile } from "@/lib/rules";

const usage = `Usage: pnpm rule "<what the rule should do>" [--approve]

The model writes one rule in the rule language; the rule is tried on the
current copy and what it would change is listed; with --approve it is
added to ${customerRulesFile}, which the next start reads.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    approve: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});
const ask = positionals.join(" ").trim();
if (values.help || !ask) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

const { rule, line } = await proposeRule(ask, modelFor("generate"));
console.log(line);
const run = await dryRun(rule);
console.log(
  `\nWould change ${run.changed.length} of the last ${run.total} ${run.kind}s${run.changed.length ? ":" : "."}`,
);
for (const { label, applied } of run.changed.slice(0, 10))
  console.log(
    `  ${label}: ${applied.map((a) => `${a.field} ${JSON.stringify(a.from)} → ${JSON.stringify(a.to)}`).join(", ")}`,
  );
if (run.changed.length > 10)
  console.log(`  and ${run.changed.length - 10} more`);
if (values.approve) {
  approve(rule);
  console.log(`\nAdded to ${customerRulesFile}; the next start applies it.`);
} else console.log("\nRun again with --approve to add it to the rules file.");
await close();
