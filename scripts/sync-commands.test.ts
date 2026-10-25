import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { commandOf, syncCommands } from "./sync-commands.mjs";

const skill = (description: string, body: string) =>
  `---\nname: x\ndescription: ${description}\n---\n\n${body}\n`;

let dir: string;
let skills: string;
let commands: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sync-commands-"));
  skills = join(dir, "skills");
  commands = join(dir, "commands");
  mkdirSync(skills);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const addSkill = (name: string, source: string) => {
  mkdirSync(join(skills, name));
  writeFileSync(join(skills, name, "SKILL.md"), source);
};

test("commandOf numbers positional arguments from $1 and leaves $ARGUMENTS", () => {
  const command = commandOf(
    skill("d", "Route `/api/$0` takes `$1`, all of it `$ARGUMENTS`."),
  );
  expect(command).toContain(
    "Route `/api/$1` takes `$2`, all of it `$ARGUMENTS`.",
  );
});

test("a skills directory with a stray file still produces every command", () => {
  addSkill("one", skill("first", "Body one"));
  addSkill("two", skill("second", "Body two"));
  writeFileSync(join(skills, ".DS_Store"), "junk");
  mkdirSync(join(skills, "not-a-skill"));

  expect(syncCommands(skills, commands)).toBe(2);
  expect(readdirSync(commands).sort()).toEqual(["one.md", "two.md"]);
  expect(readFileSync(join(commands, "one.md"), "utf8")).toBe(
    commandOf(skill("first", "Body one")),
  );
});

test("a skill that does not parse leaves the commands directory as it was", () => {
  mkdirSync(commands);
  writeFileSync(join(commands, "kept.md"), "kept");
  addSkill("good", skill("fine", "Body"));
  addSkill("bad", "no front matter");

  expect(() => syncCommands(skills, commands)).toThrow(/front matter/);
  expect(existsSync(join(commands, "kept.md"))).toBe(true);
  expect(existsSync(join(commands, "good.md"))).toBe(false);
});
