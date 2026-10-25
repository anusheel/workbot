import { parseArgs } from "node:util";
import { z } from "zod";
import { chatModel } from "@/lib/chat";
import { close } from "@/lib/db";
import { documentTypes, schemas } from "@/lib/document-model";
import { classify } from "@/lib/documents";
import { type Source, extract, fromPath } from "@/lib/extract";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { as: { type: "string" } },
});
const [path] = positionals;
if (!path) {
  console.error(
    "Usage: pnpm extract <file or url> [--as invoice|email|letter|job]",
  );
  process.exit(1);
}

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const model = chatModel("small");
const source: Source = /^https?:/.test(path)
  ? { kind: "url", url: path }
  : await fromPath(path);
const type = values.as
  ? z.enum(documentTypes).parse(values.as)
  : await classify(source, model);
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
