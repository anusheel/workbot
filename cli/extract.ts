import { existsSync } from "node:fs";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { modelFor } from "@/lib/routing";
import { close } from "@/lib/db";
import {
  type DocumentType,
  documentTypes,
  schemas,
} from "@/lib/document-model";
import { classify } from "@/lib/documents";
import { type Source, extract, fromPath, mediaTypes } from "@/lib/extract";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { as: { type: "string" } },
});
const [path] = positionals;
const kinds = documentTypes.join("|");
const fail = (message: string) => {
  console.error(message);
  process.exit(1);
};
if (!path) fail(`Usage: pnpm extract <file or url> [--as ${kinds}]`);
const kind = values.as;
if (kind !== undefined && !(documentTypes as readonly string[]).includes(kind))
  fail(`Unknown kind "${kind}". Use one of: ${documentTypes.join(", ")}.`);

const isUrl = /^https?:/.test(path);
const textExtensions = [".txt", ".md", ".eml", ".html"];
if (!isUrl) {
  if (!existsSync(path)) fail(`No such file: ${path}`);
  const extension = extname(path).toLowerCase();
  if (!(extension in mediaTypes) && !textExtensions.includes(extension))
    fail(
      `Unsupported file type "${extension}". Supported: ${[...Object.keys(mediaTypes), ...textExtensions].join(", ")}.`,
    );
}

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const model = modelFor("extract");
const source: Source = isUrl
  ? { kind: "url", url: path }
  : await fromPath(path);
const type = kind ? (kind as DocumentType) : await classify(source, model);
const { data, confidence, review, attempts } = await extract(
  source,
  schemas[type],
  model,
);
console.log(
  dim(
    `${type}${values.as ? "" : " (classified)"}, ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`,
  ),
);
console.log(JSON.stringify(data, null, 2));
console.log(
  dim(
    Object.entries(confidence)
      .map(([field, score]) => `${field} ${score.toFixed(2)}`)
      .join(" · "),
  ),
);
if (review.length) console.log(dim(`check: ${review.join(", ")}`));
await close();
