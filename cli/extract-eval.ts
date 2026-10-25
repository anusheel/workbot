import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { modelFor } from "@/lib/routing";
import { close } from "@/lib/db";
import { type DocumentType, schemas } from "@/lib/document-model";
import { classify } from "@/lib/documents";
import { type Source, extract } from "@/lib/extract";
import { same } from "@/lib/field-match";

// The documents of content/eval/documents, each with the record it should
// become in expected.json, run through classification and extraction. An
// HTML source is rendered by Chrome: as a PDF for an invoice, as an image for
// a letter or form, so the file paths are exercised, not only text.
const dir = "content/eval/documents";
type Expected = Record<
  string,
  { type: DocumentType; data: Record<string, unknown> }
>;
const expected: Expected = JSON.parse(
  await readFile(join(dir, "expected.json"), "utf8"),
);
const model = modelFor("extract");
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function source(name: string): Promise<Source> {
  const file = (await readdir(dir)).find(
    (f) => f.startsWith(`${name}.`) && f !== "expected.json",
  );
  if (!file) throw new Error(`No source for ${name}`);
  const text = await readFile(join(dir, file), "utf8");
  if (!file.endsWith(".html")) return { kind: "text", text };
  const page = await browser.newPage({
    viewport: { width: 900, height: 1200 },
  });
  await page.setContent(text);
  const pdf = expected[name].type === "invoice";
  const data = pdf
    ? await page.pdf({ format: "A4" })
    : await page.screenshot({ fullPage: true });
  await page.close();
  return {
    kind: "file",
    data: new Uint8Array(data),
    mediaType: pdf ? "application/pdf" : "image/png",
  };
}

let fields = 0;
let right = 0;
let kinds = 0;
const failures: string[] = [];
console.log("| Document | Kind | Fields right | Wrong |");
console.log("| --- | --- | --- | --- |");
for (const [name, want] of Object.entries(expected)) {
  let input: Source;
  try {
    input = await source(name);
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`);
    continue;
  }
  const type = await classify(input, model);
  if (type === want.type) kinds++;
  else failures.push(`${name}: classified as ${type}, not ${want.type}`);
  const { data } = await extract(input, schemas[want.type], model);
  const wrong = Object.keys(want.data).filter(
    (field) =>
      !same((data as Record<string, unknown>)[field], want.data[field]),
  );
  fields += Object.keys(want.data).length;
  right += Object.keys(want.data).length - wrong.length;
  console.log(
    `| ${name} | ${type === want.type ? want.type : `${type}, not ${want.type}`} | ${Object.keys(want.data).length - wrong.length} of ${Object.keys(want.data).length} | ${wrong.join(", ") || ""} |`,
  );
}
const total = Object.keys(expected).length;
console.log(
  `\n${kinds} of ${total} kinds right; ${right} of ${fields} fields right (${Math.round((100 * right) / fields)}%)`,
);
await browser.close();
await close();
if (failures.length) {
  console.error(`\n${failures.join("\n")}`);
  process.exit(1);
}
