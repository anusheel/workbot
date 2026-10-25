#!/usr/bin/env node
// The skills in .claude/skills are the source; OpenCode reads its commands from
// .opencode/commands, so each skill is written there with the front matter
// OpenCode expects. `pnpm sync:commands` rewrites the directory; the test in
// scripts/agent-config.test.ts fails when it is stale.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const commandOf = (skill) => {
  const match = skill.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("a SKILL.md needs front matter");
  const description = match[1].match(/^description:\s*(.*)$/m)?.[1] ?? "";
  return `---\ndescription: ${description}\n---\n\n${match[2].trimStart()}`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const skills = join(root, ".claude/skills");
  const commands = join(root, ".opencode/commands");
  rmSync(commands, { recursive: true, force: true });
  mkdirSync(commands);
  const names = readdirSync(skills);
  for (const name of names) {
    const source = readFileSync(join(skills, name, "SKILL.md"), "utf8");
    writeFileSync(join(commands, `${name}.md`), commandOf(source));
  }
  console.log(`${names.length} commands written to .opencode/commands`);
}
