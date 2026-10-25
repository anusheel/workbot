import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { z } from "zod";
import { modelFor } from "./routing";
import { Golden, answer, judge } from "./eval";
import { systemPrompt } from "./system-prompt";

// 3 cases from the golden set, one of each kind, judged by the small model.
const golden = z
  .array(Golden)
  .parse(JSON.parse(await readFile("content/eval/golden.json", "utf8")));
const pick = (id: string) => golden.find((g) => g.id === id)!;

test.each([["refund-limit"], ["approve-refund"], ["off-topic"]])(
  "the assistant passes the %s case under the judge",
  async (id) => {
    const golden = pick(id);
    const reply = await answer(golden, systemPrompt, modelFor("chat"));
    const verdict = await judge(golden, reply, modelFor("judge"));
    expect(verdict.violations).toEqual([]);
    expect(
      verdict.score,
      `${reply.text}\n\n${verdict.reason}`,
    ).toBeGreaterThanOrEqual(0.7);
  },
  120_000,
);
