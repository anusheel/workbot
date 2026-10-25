#!/usr/bin/env node
// The skills in .claude/skills are the source; OpenCode reads its commands from
// .opencode/commands, so each skill is written there with the front matter
// OpenCode expects. `pnpm sync:commands` rewrites the directory; the test in
// scripts/agent-config.test.ts fails when it is stale.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Claude Code numbers positional arguments from $0, OpenCode from $1.
export const commandOf = (skill) => {
  const match = skill.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("a SKILL.md needs front matter");
  const description = match[1].match(/^description:\s*(.*)$/m)?.[1] ?? "";
  const body = match[2].replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`);
  return `---\ndescription: ${description}\n---\n\n${body.trimStart()}`;
};

// Every skill is parsed before the commands directory is touched, so a skill
// that fails leaves the existing commands in place.
export const syncCommands = (skills, commands) => {
  const built = readdirSync(skills)
    .filter((name) => existsSync(join(skills, name, "SKILL.md")))
    .map((name) => [
      name,
      commandOf(readFileSync(join(skills, name, "SKILL.md"), "utf8")),
    ]);
  rmSync(commands, { recursive: true, force: true });
  mkdirSync(commands);
  for (const [name, command] of built) {
    writeFileSync(join(commands, `${name}.md`), command);
  }
  return built.length;
};

// Node resolves import.meta.url to the real path but leaves argv[1] as typed,
// so a symlinked checkout only matches once both are resolved.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const count = syncCommands(
    join(root, ".claude/skills"),
    join(root, ".opencode/commands"),
  );
  console.log(`${count} commands written to .opencode/commands`);
}
