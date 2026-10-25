import { execFileSync } from "node:child_process";
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
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test } from "vitest";
import { commandOf, syncCommands } from "./sync-commands.mjs";

const skill = (description: string, body: string) =>
  `---\nname: x\ndescription: ${description}\n---\n\n${body}\n`;

const root = new URL("../", import.meta.url);

// OpenCode's own substitution, read from its 1.19 binary: the highest numbered
// placeholder takes every argument left, the others one each.
const inOpenCode = (template: string, input: string) => {
  const args = (input.match(/\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s"']+/g) ?? []).map(
    (arg) => arg.replace(/^["']|["']$/g, ""),
  );
  const highest = Math.max(
    0,
    ...(template.match(/\$\d+/g) ?? []).map((n) => Number(n.slice(1))),
  );
  return template
    .replaceAll(/\$(\d+)/g, (_, n) =>
      Number(n) > args.length
        ? ""
        : Number(n) === highest
          ? args.slice(Number(n) - 1).join(" ")
          : args[Number(n) - 1],
    )
    .replaceAll("$ARGUMENTS", input);
};

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

test("commandOf reads $ARGUMENTS[n] as the same positional argument", () => {
  expect(
    commandOf(skill("d", "Take $ARGUMENTS[0] then $ARGUMENTS[1].")),
  ).toContain("Take $1 then $2.");
});

test("commandOf leaves a skill without numbered placeholders as it was", () => {
  expect(commandOf(skill("d", "All of it: $ARGUMENTS"))).toBe(
    "---\ndescription: d\n---\n\nAll of it: $ARGUMENTS\n",
  );
});

test("/api-route orders POST names the route orders, not orders POST", () => {
  const command = commandOf(
    readFileSync(new URL(".claude/skills/api-route/SKILL.md", root), "utf8"),
  );
  const prompt = inOpenCode(command, "orders POST");
  expect(prompt).toContain("`/api/orders`");
  expect(prompt).toContain("`src/app/api/orders/types.ts`");
  expect(prompt).not.toContain("orders POST");
  expect(prompt.trimEnd().endsWith("POST")).toBe(true);
  expect(inOpenCode(command, "orders").trimEnd().endsWith("when done.")).toBe(
    true,
  );
});

test("a skill that cannot be written leaves the commands directory as it was", () => {
  mkdirSync(commands);
  writeFileSync(join(commands, "kept.md"), "kept");
  addSkill("good", skill("fine", "Body"));
  // 255 characters is a legal directory name, but `<name>.md` is not a file name
  addSkill("a".repeat(255), skill("long", "Body"));

  expect(() => syncCommands(skills, commands)).toThrow();
  expect(readdirSync(commands)).toEqual(["kept.md"]);
  expect(readdirSync(dir).sort()).toEqual(["commands", "skills"]);
});

test("a commands directory that is, or holds, the skills is refused", () => {
  addSkill("one", skill("first", "Body one"));

  expect(() => syncCommands(skills, skills)).toThrow(/cannot be, or contain/);
  expect(() => syncCommands(skills, dir)).toThrow(/cannot be, or contain/);
  expect(existsSync(join(skills, "one", "SKILL.md"))).toBe(true);
});

test("importing the module with an argv[1] that names nothing does not throw", () => {
  const script = new URL("scripts/sync-commands.mjs", root).href;
  expect(() =>
    execFileSync(
      process.execPath,
      ["-e", `import(${JSON.stringify(script)})`, "no-such-file"],
      { cwd: fileURLToPath(root), stdio: "pipe" },
    ),
  ).not.toThrow();
});
