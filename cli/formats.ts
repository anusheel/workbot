import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { close } from "@/lib/db";
import { schemas } from "@/lib/document-model";
import { withBrowser } from "@/lib/eval-documents";
import {
  answered,
  contractCases,
  printed,
  salesExport,
  salesOrders,
  sheetQuestions,
} from "@/lib/eval-formats";
import { type Path, type Source, extract, route } from "@/lib/extract";
import { same } from "@/lib/field-match";
import { pdfPages } from "@/lib/files";
import { modelFor } from "@/lib/routing";
import { ask, readSheet, reconciles } from "@/lib/sheets";
import { type Context, spend, withTrace } from "@/lib/tracing";

// Each format WorkBot reads, measured on its own documents: ten invoices by
// every path to the model, ten contracts with their tracked changes, and five
// questions of a 50,000-row export. A field is right as the extraction eval
// judges it; cost per document is read back from the run's traces.
// Usage: pnpm formats [--only pdf|docx|xlsx] [--save <dir>]
const { values } = parseArgs({
  options: { only: { type: "string" }, save: { type: "string" } },
});
const wanted = (format: string) => !values.only || values.only === format;
const save = async (name: string, bytes: Uint8Array) => {
  if (!values.save) return;
  await mkdir(values.save, { recursive: true });
  await writeFile(join(values.save, name), bytes);
};
const model = modelFor("extract");
const pdf = "application/pdf";
const short = (value: unknown) => JSON.stringify(value)?.slice(0, 80);

/** One document read by one path: the fields it got right out of those expected, and the record, under a context the cost is read back from. */
async function scored(
  ctx: Context,
  source: Source,
  schema: (typeof schemas)[keyof typeof schemas],
  want: Record<string, unknown>,
) {
  const { data } = await withTrace(ctx, () => extract(source, schema, model));
  const got = data as Record<string, unknown>;
  const wrong = Object.keys(want).filter((f) => !same(got[f], want[f]));
  return { got, wrong, share: 1 - wrong.length / Object.keys(want).length };
}

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const perDocument = async (ctx: Context, since: Date, count: number) => {
  const { dollars, p95 } = await spend(ctx, since);
  return `$${(dollars / count).toFixed(4)} | ${p95}`;
};

if (wanted("pdf")) {
  const expected: Record<
    string,
    { type: string; data: Record<string, unknown> }
  > = JSON.parse(
    await readFile("content/eval/documents/expected.json", "utf8"),
  );
  const invoices = Object.entries(expected).filter(
    ([, c]) => c.type === "invoice",
  );
  const paths = ["text", "native", "scan"] as const;
  const ctx = (path: string): Context => ({
    caller: "formats",
    name: "pdf",
    prompt: path,
    role: "admin",
  });
  const since = new Date();
  const shares: Record<(typeof paths)[number], number[]> = {
    text: [],
    native: [],
    scan: [],
  };
  const chosen: Record<string, Path[]> = { text: [], scan: [] };
  const notes: string[] = [];
  let pages = 0;
  await withBrowser(async (browser) => {
    for (const [name, { data: want }] of invoices) {
      const html = await readFile(
        `content/eval/documents/${name}.html`,
        "utf8",
      );
      const { text, scan } = await printed(browser, html);
      await save(`${name}.pdf`, text);
      await save(`${name}-scan.pdf`, scan);
      pages += (await pdfPages(text)).length;
      const textRoute = await route({
        kind: "file",
        data: text,
        mediaType: pdf,
      });
      const scanRoute = await route({
        kind: "file",
        data: scan,
        mediaType: pdf,
      });
      chosen.text.push(textRoute.path);
      chosen.scan.push(scanRoute.path);
      const sources: Record<(typeof paths)[number], Source> = {
        text: textRoute.source,
        native: { kind: "file", data: text, mediaType: pdf },
        scan: scanRoute.source,
      };
      const results = Object.fromEntries(
        await Promise.all(
          paths.map(async (path) => [
            path,
            await scored(ctx(path), sources[path], schemas.invoice, want),
          ]),
        ),
      ) as Record<(typeof paths)[number], Awaited<ReturnType<typeof scored>>>;
      for (const path of paths) shares[path].push(results[path].share);
      for (const field of Object.keys(want)) {
        const right = (path: "text" | "native") =>
          !results[path].wrong.includes(field);
        if (right("text") !== right("native")) {
          const loser = right("text") ? "native" : "text";
          notes.push(
            `- ${name} ${field}: ${right("text") ? "text" : "file"} right; the ${loser === "text" ? "text" : "file"} gave ${short(results[loser].got[field])}, expected ${short(want[field])}`,
          );
        }
      }
      for (const path of paths)
        if (results[path].wrong.length)
          console.error(
            `${name} ${path}: wrong ${results[path].wrong.join(", ")}`,
          );
    }
  });
  const count = (paths: Path[], path: Path) =>
    `${paths.filter((p) => p === path).length}/${paths.length}`;
  console.log(`\n## PDF: ${invoices.length} invoices, ${pages} pages\n`);
  console.log(
    "| Path | Chosen by the router | Fields right | $/document | p95 ms |",
  );
  console.log("| --- | --- | --- | --- | --- |");
  console.log(
    `| Text layer | ${count(chosen.text, "text")} text PDFs | ${mean(shares.text).toFixed(2)} | ${await perDocument(ctx("text"), since, invoices.length)} |`,
  );
  console.log(
    `| File, text PDF | forced | ${mean(shares.native).toFixed(2)} | ${await perDocument(ctx("native"), since, invoices.length)} |`,
  );
  console.log(
    `| File, scan | ${count(chosen.scan, "native")} scans | ${mean(shares.scan).toFixed(2)} | ${await perDocument(ctx("scan"), since, invoices.length)} |`,
  );
  console.log(
    `\nWhere the text and the file disagree:\n${notes.join("\n") || "- nowhere"}`,
  );
}

if (wanted("docx")) {
  const cases = await contractCases();
  const ctx: Context = { caller: "formats", name: "docx", role: "admin" };
  const since = new Date();
  const results = [];
  for (const { name, bytes, want } of cases) {
    await save(`${name}.docx`, bytes);
    const { source } = await route({
      kind: "file",
      data: bytes,
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await scored(ctx, source, schemas.contract, want);
    if (result.wrong.length)
      console.error(
        `${name}: wrong ${result.wrong.map((f) => `${f} ${short(result.got[f])}`).join("; ")}`,
      );
    results.push(result);
  }
  const kept = results.filter((r) => !r.wrong.includes("changes")).length;
  console.log(`\n## DOCX: ${cases.length} contracts\n`);
  console.log("| Fields right | Every change kept | $/document | p95 ms |");
  console.log("| --- | --- | --- | --- |");
  console.log(
    `| ${mean(results.map((r) => r.share)).toFixed(2)} | ${kept}/${cases.length} | ${await perDocument(ctx, since, cases.length)} |`,
  );
}

if (wanted("xlsx")) {
  const orders = salesOrders();
  const bytes = await salesExport(orders);
  await save("sales-2025.xlsx", bytes);
  const started = performance.now();
  const table = await readSheet(bytes);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const totals = table.totals
    .map((t) => `${t.column} ${reconciles(t) ? "reconciles" : "is off"}`)
    .join(", ");
  console.log(
    `\n## XLSX: ${table.rows.length.toLocaleString("en-US")} rows, ${(bytes.length / 1e6).toFixed(1)} MB, read in ${seconds} s; totals: ${totals}\n`,
  );
  console.log("| Question | Right | Queries | $ | Answer |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const { question, truth } of sheetQuestions) {
    const { answer, queries, dollars } = await withTrace(
      { caller: "formats", name: "xlsx", role: "admin" },
      () => ask(table, question, modelFor("analyze")),
    );
    const right = answered(answer, truth(orders));
    console.log(
      `| ${question} | ${right ? "yes" : "no"} | ${queries.length} | $${dollars.toFixed(4)} | ${answer.replace(/\s+/g, " ")} |`,
    );
    for (const q of queries)
      console.error(
        `  ${q.sql.replace(/\s+/g, " ")}${"error" in q ? ` → ${q.error}` : ""}`,
      );
  }
}
await close();
