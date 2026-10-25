import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const agentDocs = [
  "site/AGENTS.md",
  "src/app/api/AGENTS.md",
  "content/knowledge/AGENTS.md",
];

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
    mcp?: Record<string, unknown>;
  };
}

function mcpNamesFromMcpJson(source: string): string[] {
  const { mcpServers } = JSON.parse(source) as {
    mcpServers: Record<string, unknown>;
  };
  return Object.keys(mcpServers);
}

function mcpNamesFromCodex(source: string): string[] {
  return [...source.matchAll(/\[mcp_servers\.([^\]]+)\]/g)].map((m) => m[1]);
}

function mcpNamesFromOpenCode(source: string): string[] {
  return Object.keys(parseJsonc(source).mcp ?? {});
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

test("the three configs declare the same MCP servers", () => {
  const inMcpJson = mcpNamesFromMcpJson(read(".mcp.json")).sort();
  const inCodex = mcpNamesFromCodex(read(".codex/config.toml")).sort();
  const inOpenCode = mcpNamesFromOpenCode(read("opencode.jsonc")).sort();
  expect(inMcpJson).toEqual(inCodex);
  expect(inMcpJson).toEqual(inOpenCode);
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
