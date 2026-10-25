import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { format, resolveConfig } from "prettier";
import { generate, index } from "@/lib/entity-generator";
import { Entity } from "@/lib/entity-model";

const usage = `Usage: pnpm generate [--check]

Reads every description in content/entities, writes the files each
becomes and removes generated files no description asks for any more;
--check writes nothing and fails when a file differs from what its
description says or should not exist, which is how a hand edit to
generated code is caught.`;

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

/** Every file under src that says in its first lines that the generator wrote it. */
const generatedBefore = (
  readdirSync("src", {
    recursive: true,
    withFileTypes: true,
  }) as import("node:fs").Dirent[]
)
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name))
  .filter((path) =>
    readFileSync(path, "utf8").slice(0, 300).includes("by pnpm generate. Edit"),
  );
const orphans = generatedBefore.filter(
  (path) => !files.some((f) => f.path === path),
);

let stale = 0;
for (const path of orphans) {
  if (values.check) {
    stale++;
    console.log(`orphan: ${path}`);
  } else {
    rmSync(path);
    try {
      rmdirSync(dirname(path));
    } catch {
      // The folder still holds other files.
    }
    console.log(`removed: ${path}`);
  }
}
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
