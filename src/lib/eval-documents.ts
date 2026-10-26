import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModel } from "ai";
import type { Browser } from "playwright-core";
import { chrome } from "./chrome";
import { type DocumentType, schemas } from "./document-model";
import { classify } from "./documents";
import { type Source, extract } from "./extract";
import { same } from "./field-match";

/** An eval document: its source, the kind and fields it should be read as, and whether every pull request runs it. */
export type DocumentCase = {
  name: string;
  source: Source;
  want: { type: DocumentType; data: Record<string, unknown> };
  smoke: boolean;
};

const dir = "content/eval/documents";

/**
 * The documents of content/eval/documents, each with the record it should
 * become (expected.json). An HTML source is rendered by the browser, as a PDF
 * for an invoice and as an image otherwise, so the file paths are exercised,
 * not only text.
 */
export async function documentCases(browser: Browser): Promise<DocumentCase[]> {
  const expected: Record<string, DocumentCase["want"] & { smoke?: boolean }> =
    JSON.parse(await readFile(join(dir, "expected.json"), "utf8"));
  const files = await readdir(dir);
  const cases: DocumentCase[] = [];
  for (const [name, { smoke = false, ...want }] of Object.entries(expected)) {
    const file = files.find(
      (f) => f.startsWith(`${name}.`) && f !== "expected.json",
    );
    if (!file) throw new Error(`No source for ${name}`);
    const text = await readFile(join(dir, file), "utf8");
    if (!file.endsWith(".html")) {
      cases.push({ name, want, smoke, source: { kind: "text", text } });
      continue;
    }
    const page = await browser.newPage({
      viewport: { width: 900, height: 1200 },
    });
    await page.setContent(text);
    const pdf = want.type === "invoice";
    const data = pdf
      ? await page.pdf({ format: "A4" })
      : await page.screenshot({ fullPage: true });
    await page.close();
    cases.push({
      name,
      want,
      smoke,
      source: {
        kind: "file",
        data: new Uint8Array(data),
        mediaType: pdf ? "application/pdf" : "image/png",
      },
    });
  }
  return cases;
}

/** Opens a Chrome for the documents that need rendering, and closes it after `fn`. */
export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>) {
  const browser = await chrome();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/** One document through classification and extraction: the kind it was taken for, and the fields that came out wrong. */
export async function extractionResult(
  { source, want }: DocumentCase,
  model: LanguageModel,
) {
  const type = await classify(source, model);
  const { data } = await extract(source, schemas[want.type], model);
  const wrong = Object.keys(want.data).filter(
    (field) =>
      !same((data as Record<string, unknown>)[field], want.data[field]),
  );
  return { type, wrong };
}
