import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { query } from "./db";
import {
  extractMemories,
  forget,
  forgetAll,
  listMemories,
  memoryNote,
  remember,
} from "./memory";

test("memories are per visitor, newest first, and never duplicated", async () => {
  await remember("v1", "entity", "The person works in the finance team.");
  await remember("v1", "entity", "The person works in the finance team.");
  await remember("v1", "preference", "The person wants short answers.");
  await remember(
    "v2",
    "case",
    "The person is handling the badge printer request.",
  );
  const mine = await listMemories("v1");
  expect(mine.map((m) => m.text)).toEqual([
    "The person wants short answers.",
    "The person works in the finance team.",
  ]);

  await forget("v1", mine[0].id);
  expect((await listMemories("v1")).map((m) => m.kind)).toEqual(["entity"]);
  await forgetAll("v1");
  expect(await listMemories("v1")).toEqual([]);
  expect(await listMemories("v2")).toHaveLength(1);
});

test("the memory note lists what is known, and is empty when nothing is", () => {
  expect(memoryNote([])).toBe("");
  const note = memoryNote([
    {
      id: "1",
      kind: "preference",
      text: "The person wants short answers.",
      createdAt: new Date(),
    },
  ]);
  expect(note).toContain("- The person wants short answers. (preference)");
});

test("the note carries the newest 30 memories, and the list still has them all", async () => {
  // Explicit minutes apart: rows inserted back to back can share a timestamp,
  // and then "newest" is not defined.
  await query(
    `insert into memories (visitor, kind, text, created_at)
     select 'v3', 'case', 'The person is on case ' || i || '.', now() - make_interval(mins => 40 - i)
     from generate_series(1, 40) as i`,
    [],
  );
  const all = await listMemories("v3");
  expect(all).toHaveLength(40);
  expect(await listMemories("v3", 5)).toHaveLength(5);
  const lines = memoryNote(all).split("\n").slice(1);
  expect(lines).toHaveLength(30);
  expect(lines[0]).toContain("case 40.");
  expect(lines[29]).toContain("case 11.");
});

test("extraction asks a model for durable facts and returns them typed", async () => {
  let instructions = "";
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      instructions = String(prompt.find((m) => m.role === "system")?.content);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              memories: [
                {
                  kind: "entity",
                  text: "The person manages the vendor Fieldstone Freight.",
                },
              ],
            }),
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  const known = [
    {
      id: "1",
      kind: "preference" as const,
      text: "The person wants short answers.",
      createdAt: new Date(),
    },
  ];
  const memories = await extractMemories(
    model,
    {
      user: "I manage Fieldstone Freight, our main carrier.",
      assistant: "Noted.",
    },
    known,
  );
  expect(memories).toEqual([
    {
      kind: "entity",
      text: "The person manages the vendor Fieldstone Freight.",
    },
  ]);
  expect(instructions).toContain(
    "Already known:\n- The person wants short answers.",
  );

  const forty = Array.from({ length: 40 }, (_, i) => ({
    id: String(40 - i),
    kind: "case" as const,
    text: `The person is on case ${40 - i}.`,
    createdAt: new Date(),
  }));
  await extractMemories(model, { user: "Hi.", assistant: "Hello." }, forty);
  expect(instructions).toContain("- The person is on case 40.");
  expect(instructions).toContain("- The person is on case 11.");
  expect(instructions).not.toContain("- The person is on case 10.");
});
