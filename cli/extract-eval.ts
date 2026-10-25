import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { chatModel } from "@/lib/chat";
import { close } from "@/lib/db";
import { type DocumentType, schemas } from "@/lib/document-model";
import { classify } from "@/lib/documents";
import { type Source, extract } from "@/lib/extract";

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
const model = chatModel("small");
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

/**
 * A field is right when what was extracted carries what was expected: a
 * string contains the expected text, case and spacing aside; a list holds
 * every expected item; a record every expected field; a number is equal.
 */
function same(got: unknown, want: unknown): boolean {
  if (Array.isArray(want))
    return Array.isArray(got) && want.every((w) => got.some((g) => same(g, w)));
  if (want && typeof want === "object")
    return (
      !!got &&
      typeof got === "object" &&
      Object.entries(want).every(([k, w]) =>
        same((got as Record<string, unknown>)[k], w),
      )
    );
  if (typeof want === "string" && typeof got === "string")
    return normal(got).includes(normal(want));
  return got === want;
}
const normal = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

let fields = 0;
let right = 0;
let kinds = 0;
console.log("| Document | Kind | Fields right | Wrong |");
console.log("| --- | --- | --- | --- |");
for (const [name, want] of Object.entries(expected)) {
  const input = await source(name);
  const type = await classify(input, model);
  if (type === want.type) kinds++;
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
