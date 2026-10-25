import { expect, test } from "vitest";
import { explain } from "./explainer";

test("the explainer pipeline runs its 3 agents on the Claude Code sign-in and returns an approved reply", async () => {
  const agents: string[] = [];
  const result = await explain(
    "Why was my refund only $200 when I paid $250 for the damaged shelving?",
    {
      trace: (e) =>
        e.tool.startsWith("agent:") &&
        e.event === "call" &&
        agents.push(e.tool.slice(6)),
    },
    undefined,
    "haiku",
  );
  // The researcher may be sent back by a guardrail, so order holds loosely: research, then write, then edit.
  expect(agents[0]).toBe("researcher");
  expect(agents).toEqual(
    expect.arrayContaining(["researcher", "writer", "editor"]),
  );
  expect(agents.indexOf("writer")).toBeLessThan(agents.lastIndexOf("editor"));
  expect(result.reply.length).toBeGreaterThan(100);
  expect(result.reply).toMatch(/200/);
  expect(result.turns).toBeGreaterThanOrEqual(3);
}, 300_000);
