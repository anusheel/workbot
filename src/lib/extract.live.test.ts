import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, expect, test } from "vitest";
import { modelFor } from "./routing";
import { Email, Invoice, Letter } from "./document-model";
import { classify } from "./documents";
import { type Source, extract } from "./extract";

// The eval's documents, rendered the way they would arrive: an invoice as a
// PDF, a form as an image, an email as text.
const dir = "content/eval/documents";
let browser: Awaited<ReturnType<typeof chromium.launch>>;
beforeAll(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
afterAll(() => browser.close());

async function rendered(name: string, as: "pdf" | "png"): Promise<Source> {
  const page = await browser.newPage({
    viewport: { width: 900, height: 1200 },
  });
  await page.setContent(await readFile(`${dir}/${name}.html`, "utf8"));
  const data =
    as === "pdf"
      ? await page.pdf({ format: "A4" })
      : await page.screenshot({ fullPage: true });
  await page.close();
  return {
    kind: "file",
    data: new Uint8Array(data),
    mediaType: as === "pdf" ? "application/pdf" : "image/png",
  };
}

test("an invoice PDF comes back as a typed record with its totals", async () => {
  const model = modelFor("extract");
  const source = await rendered("invoice-1", "pdf");
  expect(await classify(source, model)).toBe("invoice");
  const { data, review } = await extract(source, Invoice, model);
  expect(data).toMatchObject({
    vendor: "Acme Supplies Co.",
    number: "INV-4471",
    due: "2026-10-31",
    currency: "USD",
    total: 1551.35,
  });
  expect(data.lines).toHaveLength(2);
  expect(review).not.toContain("total");
}, 120_000);

test("a filled form as an image keeps its fields, and an email its intent and urgency", async () => {
  const model = modelFor("extract");
  const form = await extract(await rendered("letter-2", "png"), Letter, model);
  expect(form.data.fields).toEqual(
    expect.arrayContaining([{ name: "Visitor name", value: "Lena Ortiz" }]),
  );
  const email = await extract(
    { kind: "text", text: await readFile(`${dir}/email-1.txt`, "utf8") },
    Email,
    model,
  );
  expect(email.data).toMatchObject({ intent: "complaint", urgency: "high" });
  expect(email.data.to).toContain("support@fieldstone.example");
  expect(email.data.actions.length).toBeGreaterThan(0);
}, 120_000);
