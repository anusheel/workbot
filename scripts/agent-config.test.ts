import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

// Untracked files count too, so a new package is checked before it is committed.
const agentDocs = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: fileURLToPath(root), encoding: "utf8" },
)
  .split("\n")
  .filter((file) => file.endsWith("/AGENTS.md"));

type McpServer = { url: string } | { command: string[] };
type McpDefinition = {
  url?: string;
  command?: string | string[];
  args?: string[];
};

// opencode.jsonc is JSON with // comment lines and trailing commas, neither
// of which JSON.parse accepts.
function parseJsonc(source: string) {
  const stripped = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped) as {
    instructions?: string[];
    permission?: { read?: string | Record<string, string> };
    mcp?: Record<string, McpDefinition>;
  };
}

// The Codex tables read here are `key = value` lines whose values are also
// valid JSON, so no TOML parser is needed. The table "" holds the top-level keys.
function tomlTables(source: string) {
  const tables = new Map<string, Record<string, unknown>>([["", {}]]);
  // Undefined inside an array table such as [[skills.config]], which is not read here.
  let current: Record<string, unknown> | undefined = tables.get("");
  for (const line of source.split("\n")) {
    if (line.startsWith("[")) {
      const name = line.match(/^\[([^[\]]+)\]\s*$/)?.[1];
      current = name ? {} : undefined;
      if (name && current) tables.set(name, current);
      continue;
    }
    const entry = line.match(/^("[^"]+"|[\w-]+)\s*=\s*(.+)$/);
    if (entry && current) {
      current[entry[1].replace(/^"|"$/g, "")] = JSON.parse(entry[2]);
    }
  }
  return tables;
}

// Each CLI spells a server differently (`type: http`/`remote`, `args` apart
// from or inside `command`); what has to agree is where it points or what it runs.
function serverOf(definition: McpDefinition): McpServer {
  if (definition.url) return { url: definition.url };
  if (!definition.command)
    throw new Error("an MCP server has no url or command");
  return { command: [definition.command, ...(definition.args ?? [])].flat() };
}

function mcpServersFromMcpJson(source: string) {
  const { mcpServers } = JSON.parse(source) as {
    mcpServers: Record<string, McpDefinition>;
  };
  return Object.fromEntries(
    Object.entries(mcpServers).map(([name, def]) => [name, serverOf(def)]),
  );
}

function mcpServersFromCodex(source: string) {
  return Object.fromEntries(
    [...tomlTables(source)]
      .filter(([name]) => name.startsWith("mcp_servers."))
      .map(([name, def]) => [
        name.slice("mcp_servers.".length),
        serverOf(def as McpDefinition),
      ]),
  );
}

function mcpServersFromOpenCode(source: string) {
  return Object.fromEntries(
    Object.entries(parseJsonc(source).mcp ?? {}).map(([name, def]) => [
      name,
      serverOf(def),
    ]),
  );
}

// `*` stays inside a path segment and `**/` spans directories, which is all
// the env-file patterns in these configs use.
function globMatches(pattern: string, path: string) {
  const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const source = pattern
    .split("**/")
    .map((part) => part.split("*").map(escape).join("[^/]*"))
    .join("(?:.*/)?");
  return new RegExp(`^${source}$`).test(path);
}

function claudeDeniesRead(source: string, path: string) {
  const { permissions } = JSON.parse(source) as {
    permissions?: { deny?: string[] };
  };
  return (permissions?.deny ?? []).includes(`Read(./${path})`);
}

function codexDeniesRead(source: string, path: string) {
  const tables = tomlTables(source);
  const profile = tables.get("")?.default_permissions;
  return [...tables]
    .filter(([name]) => name.startsWith(`permissions.${profile}.filesystem`))
    .flatMap(([, rules]) => Object.entries(rules))
    .some(
      ([pattern, action]) => action === "deny" && globMatches(pattern, path),
    );
}

function opencodeDeniesRead(source: string, path: string) {
  const rules = parseJsonc(source).permission?.read;
  if (typeof rules === "string") return rules === "deny";
  // The last matching pattern wins, so a later allow would undo an earlier deny.
  const matching = Object.entries(rules ?? {}).filter(([pattern]) =>
    globMatches(pattern, path),
  );
  return matching.at(-1)?.[1] === "deny";
}

function skillPathsFromCodex(source: string): string[] {
  return source
    .split("[[skills.config]]")
    .slice(1)
    .map((entry) => {
      const path = entry.match(/path\s*=\s*"([^"]+)"/)?.[1];
      if (!path) throw new Error("a skills.config entry has no path");
      return path;
    });
}

test("the three configs declare the same MCP servers, each with the same url or command", () => {
  const inMcpJson = mcpServersFromMcpJson(read(".mcp.json"));
  expect(
    mcpServersFromCodex(read(".codex/config.toml")),
    ".codex/config.toml differs from .mcp.json",
  ).toEqual(inMcpJson);
  expect(
    mcpServersFromOpenCode(read("opencode.jsonc")),
    "opencode.jsonc differs from .mcp.json",
  ).toEqual(inMcpJson);
});

test("each config denies reading .env.local", () => {
  expect(
    claudeDeniesRead(read(".claude/settings.json"), ".env.local"),
    ".claude/settings.json does not deny Read(./.env.local)",
  ).toBe(true);
  expect(
    codexDeniesRead(read(".codex/config.toml"), ".env.local"),
    ".codex/config.toml has no deny filesystem rule matching .env.local",
  ).toBe(true);
  expect(
    opencodeDeniesRead(read("opencode.jsonc"), ".env.local"),
    "opencode.jsonc does not deny reading .env.local",
  ).toBe(true);
});

test("every AGENTS.md below the root is an instruction in opencode.jsonc", () => {
  const instructions = parseJsonc(read("opencode.jsonc")).instructions ?? [];
  for (const doc of agentDocs) {
    expect(instructions).toContain(doc);
  }
});

test("every AGENTS.md has a CLAUDE.md beside it that imports it", () => {
  for (const doc of agentDocs) {
    expect(read(doc.replace(/AGENTS\.md$/, "CLAUDE.md")).trim()).toBe(
      "@AGENTS.md",
    );
  }
});

test("every skill is a Codex skills.config entry and an OpenCode command written from it", async () => {
  const { commandOf } = await import("./sync-commands.mjs");
  const skills = readdirSync(new URL(".claude/skills/", root), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const codexPaths = skillPathsFromCodex(read(".codex/config.toml"));
  // The commands directory is generated: one file per skill and nothing stale.
  expect(readdirSync(new URL(".opencode/commands/", root)).sort()).toEqual(
    skills.map((skill) => `${skill}.md`).sort(),
  );
  for (const skill of skills) {
    expect(codexPaths).toContain(`.claude/skills/${skill}`);
    // The command is the skill with OpenCode's front matter; pnpm sync:commands rewrites it.
    expect(read(`.opencode/commands/${skill}.md`)).toBe(
      commandOf(read(`.claude/skills/${skill}/SKILL.md`)),
    );
  }
});
