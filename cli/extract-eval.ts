import { chromium } from "playwright-core";
import { close } from "@/lib/db";
import { documentCases, extractionResult } from "@/lib/eval-documents";
import { modelFor } from "@/lib/routing";

// The documents of content/eval/documents, each with the record it should
// become, through classification and extraction on the extract route.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const cases = await documentCases(browser);
await browser.close();
const model = modelFor("extract");

let fields = 0;
let right = 0;
let kinds = 0;
const failures: string[] = [];
console.log("| Document | Kind | Fields right | Wrong |");
console.log("| --- | --- | --- | --- |");
for (const c of cases) {
  const { type, wrong } = await extractionResult(c, model);
  const total = Object.keys(c.want.data).length;
  if (type === c.want.type) kinds++;
  else failures.push(`${c.name}: classified as ${type}, not ${c.want.type}`);
  fields += total;
  right += total - wrong.length;
  console.log(
    `| ${c.name} | ${type === c.want.type ? type : `${type}, not ${c.want.type}`} | ${total - wrong.length} of ${total} | ${wrong.join(", ")} |`,
  );
}
console.log(
  `\n${kinds} of ${cases.length} kinds right; ${right} of ${fields} fields right (${Math.round((100 * right) / fields)}%)`,
);
await close();
if (failures.length) {
  console.error(`\n${failures.join("\n")}`);
  process.exit(1);
}
