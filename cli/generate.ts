import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { format, resolveConfig } from "prettier";
import { generate, index } from "@/lib/entity-generator";
import { Entity } from "@/lib/entity-model";

const usage = `Usage: pnpm generate [--check]

Reads every description in content/entities and writes the files each
becomes; --check writes nothing and fails when a file differs from what
its description says, which is how a hand edit to generated code is caught.`;

const { values } = parseArgs({
  options: {
    check: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});
if (values.help) {
  console.log(usage);
  process.exit(0);
}

const dir = "content/entities";
const entities = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => Entity.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))));
const files = [...entities.flatMap(generate), ...index(entities)];

let stale = 0;
for (const { path, source } of files) {
  const options = (await resolveConfig(path)) ?? {};
  const formatted = await format(source, { ...options, filepath: path });
  if (values.check) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current !== formatted) {
      stale++;
      console.log(`stale: ${path}`);
    }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, formatted);
    console.log(path);
  }
}
if (values.check) {
  if (stale) {
    console.log(
      `${stale} generated file(s) differ from their descriptions; run pnpm generate`,
    );
    process.exit(1);
  }
  console.log(`${files.length} generated files match their descriptions`);
}
