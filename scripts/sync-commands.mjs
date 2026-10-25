#!/usr/bin/env node
// The skills in .claude/skills are the source; OpenCode reads its commands from
// .opencode/commands, so each skill is written there with the front matter
// OpenCode expects. `pnpm sync:commands` rewrites the directory; the test in
// scripts/agent-config.test.ts fails when it is stale.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";

// Claude Code numbers positional arguments from $0 (and spells them
// $ARGUMENTS[0] too), OpenCode from $1. OpenCode hands the highest numbered
// placeholder every argument left, where Claude Code's $N is only the Nth, so
// a trailing placeholder takes the rest and `/api-route orders POST` keeps
// "POST" out of the route name. The rewrite is textual: a `$` followed by
// digits is a placeholder wherever it stands, code spans included, so a skill
// cannot carry a literal `$1` (a shell `awk '{print $1}'`, a price).
export const commandOf = (skill) => {
  const match = skill.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("a SKILL.md needs front matter");
  const description = match[1].match(/^description:\s*(.*)$/m)?.[1] ?? "";
  let body = match[2].replace(
    /\$ARGUMENTS\[(\d+)\]|\$(\d+)/g,
    (_, indexed, bare) => `$${Number(indexed ?? bare) + 1}`,
  );
  const numbers = [...body.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  if (numbers.length)
    body = `${body.trimEnd()}\n\n$${Math.max(...numbers) + 1}\n`;
  return `---\ndescription: ${description}\n---\n\n${body.trimStart()}`;
};

// The commands are written to a sibling directory and swapped in with a
// rename, so a skill that fails to parse, or a write that fails, leaves the
// existing commands in place.
export const syncCommands = (skills, commands) => {
  const rel = relative(resolve(commands), resolve(skills));
  if (rel === "" || !(rel.startsWith("..") || isAbsolute(rel))) {
    throw new Error("the commands directory cannot be, or contain, the skills");
  }
  const built = readdirSync(skills)
    .filter((name) => existsSync(join(skills, name, "SKILL.md")))
    .map((name) => [
      name,
      commandOf(readFileSync(join(skills, name, "SKILL.md"), "utf8")),
    ]);
  mkdirSync(dirname(commands), { recursive: true });
  const staging = mkdtempSync(
    join(dirname(commands), `.${basename(commands)}-`),
  );
  const previous = `${staging}.previous`;
  try {
    for (const [name, command] of built) {
      writeFileSync(join(staging, `${name}.md`), command);
    }
    if (existsSync(commands)) renameSync(commands, previous);
    renameSync(staging, commands);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    if (existsSync(previous) && !existsSync(commands)) {
      renameSync(previous, commands);
    }
    throw error;
  }
  rmSync(previous, { recursive: true, force: true });
  return built.length;
};

// Node resolves import.meta.url to the real path but leaves argv[1] as typed,
// so a symlinked checkout only matches once both are resolved. argv[1] can
// name nothing at all (`node -e`, a REPL), which is not the script.
const runAsMain = () => {
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
};

if (runAsMain()) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const count = syncCommands(
    join(root, ".claude/skills"),
    join(root, ".opencode/commands"),
  );
  console.log(`${count} commands written to .opencode/commands`);
}
