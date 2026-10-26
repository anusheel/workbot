import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { z } from "zod";
import { scripted } from "@/test/model";
import { runAgent } from "./agent";
import { tool } from "./tools";

const lookups: string[] = [];
const tools = [
  tool({
    name: "lookup",
    access: "public",
    description: "Looks something up",
    input: z.object({ term: z.string() }),
    run: ({ term }) => {
      lookups.push(term);
      return term === "void"
        ? Promise.reject(new Error("nothing there"))
        : `${term} is in aisle 4`;
    },
  }),
  tool({
    name: "finish",
    access: "public",
    description: "Ends with the answer",
    input: z.object({ answer: z.string() }),
    run: ({ answer }) => answer,
  }),
];

test("runs tools the model calls, feeds results back, and ends on the terminal tool", async () => {
  const { model, prompts } = scripted([
    {
      text: "I will look up labels.",
      calls: [{ name: "lookup", input: { term: "labels" } }],
    },
    {
      calls: [{ name: "finish", input: { answer: "Labels are in aisle 4." } }],
    },
  ]);
  const thoughts: string[] = [];
  const calls: string[] = [];
  const run = await runAgent({
    model,
    system: "Be brief.",
    task: "Where are the labels?",
    tools,
    done: "finish",
    on: {
      thought: (t) => thoughts.push(t),
      tool: (c) => calls.push(`${c.name}:${c.result}`),
    },
  });
  expect(run).toMatchObject({
    answer: "Labels are in aisle 4.",
    steps: 2,
    stopped: "answered",
    usage: { input: 200, output: 100 },
  });
  expect(run.dollars).toBeCloseTo((200 * 0.1 + 100 * 0.5) / 1e6);
  expect(thoughts).toEqual(["I will look up labels."]);
  expect(calls).toEqual([
    "lookup:labels is in aisle 4",
    "finish:Labels are in aisle 4.",
  ]);
  const toolMessage = prompts[1].find((m) => m.role === "tool");
  expect(JSON.stringify(toolMessage)).toContain("labels is in aisle 4");
});

test("a failing tool is reported to the model as an error, and the loop goes on", async () => {
  const { model, prompts } = scripted([
    { calls: [{ name: "lookup", input: { term: "void" } }] },
    { text: "Nothing to find." },
  ]);
  const run = await runAgent({
    model,
    system: "",
    task: "?",
    tools,
    done: "finish",
  });
  expect(run).toMatchObject({
    answer: "Nothing to find.",
    stopped: "answered",
    steps: 2,
  });
  expect(JSON.stringify(prompts[1])).toContain("nothing there");
});

test("the step limit stops the loop with what it has", async () => {
  const { model } = scripted([
    { calls: [{ name: "lookup", input: { term: "a" } }] },
    { calls: [{ name: "lookup", input: { term: "b" } }] },
    { calls: [{ name: "finish", input: { answer: "never reached" } }] },
  ]);
  const run = await runAgent({
    model,
    system: "",
    task: "?",
    tools,
    done: "finish",
    limits: { steps: 2 },
  });
  expect(run).toMatchObject({ answer: "", steps: 2, stopped: "steps" });
});

test("the dollar limit stops the loop", async () => {
  const { model } = scripted([
    { calls: [{ name: "lookup", input: { term: "a" } }] },
    { text: "late" },
  ]);
  const run = await runAgent({
    model,
    system: "",
    task: "?",
    tools,
    limits: { dollars: 0.00001 },
  });
  expect(run.stopped).toBe("dollars");
});

test("a tool that outlives the time limit fails, and the run ends on time", async () => {
  const { model } = scripted([
    { calls: [{ name: "wait", input: {} }] },
    { text: "late" },
  ]);
  const calls: string[] = [];
  const run = await runAgent({
    model,
    system: "",
    task: "?",
    tools: [
      ...tools,
      tool({
        name: "wait",
        access: "public",
        description: "Never answers",
        input: z.object({}),
        run: () => new Promise<string>(() => {}),
      }),
    ],
    limits: { seconds: 0.1 },
    on: { tool: (c) => calls.push(`${c.name}:${c.failed}:${c.result}`) },
  });
  expect(calls).toEqual(["wait:true:The tool ran out of time."]);
  expect(run).toMatchObject({ stopped: "time", steps: 1 });
});

test("a model call that outlives the time limit ends the run with what it has", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: ({ abortSignal }) =>
      new Promise((_, reject) =>
        abortSignal?.addEventListener("abort", () =>
          reject(abortSignal.reason),
        ),
      ),
  });
  const run = await runAgent({
    model,
    system: "",
    task: "?",
    tools,
    limits: { seconds: 0.05 },
  });
  expect(run).toMatchObject({ stopped: "time", steps: 0, answer: "" });
});
