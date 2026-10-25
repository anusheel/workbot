import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { expect, test } from "vitest";
import {
  type ResearchModel,
  type ResearchState,
  researchGraph,
} from "./langgraph";

type Turn = AIMessage | Error;

// A model that answers from a script, one message per call; an Error in the
// script is thrown in its turn, as a killed process would end the run there.
function scripted(turns: Turn[]): ResearchModel {
  const model = {
    async invoke(_messages: BaseMessage[]) {
      const turn = turns.shift();
      if (!turn) throw new Error("The script ran out.");
      if (turn instanceof Error) throw turn;
      return turn;
    },
    bindTools: () => model,
  };
  return model;
}

const said = (content: string, tool_calls: AIMessage["tool_calls"] = []) =>
  new AIMessage({
    content,
    tool_calls,
    usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  });

test("a run resumes on its thread from the last checkpoint, keeping what the tools saved", async () => {
  const model = scripted([
    said("Look up the refund policy."),
    said("Searching.", [
      {
        id: "1",
        name: "web_search",
        args: { query: "refunds" },
        type: "tool_call",
      },
      {
        id: "2",
        name: "save_finding",
        args: { text: "Refunds take 5 days.", source: "Refunds" },
        type: "tool_call",
      },
    ]),
    new Error("killed"),
    said("That is enough."),
    said("", [
      {
        id: "3",
        name: "write_report",
        args: { report: "Refunds take 5 days [1].\n[1] Refunds" },
        type: "tool_call",
      },
    ]),
  ]);
  const graph = researchGraph({ model, checkpointer: new MemorySaver() });
  const at = { configurable: { thread_id: "t1" } };

  await expect(graph.invoke({ topic: "refunds" }, at)).rejects.toThrow(
    "killed",
  );
  const paused = (await graph.getState(at)).values as ResearchState;
  expect(paused.findings).toEqual([
    { text: "Refunds take 5 days.", source: "Refunds" },
  ]);
  expect(paused.calls).toBe(2);

  const state = (await graph.invoke(null, at)) as ResearchState;
  expect(state.report).toBe("Refunds take 5 days [1].\n[1] Refunds");
  expect(state.findings).toHaveLength(1);
  expect(state.calls).toBe(3);
  expect(state.usage).toEqual({ input: 40, output: 20 });
});

test("the loop goes to the tools while the model calls them, then to the report", async () => {
  const model = scripted([
    said("Plan."),
    said("", [
      {
        id: "1",
        name: "save_finding",
        args: { text: "Cutoff is 3 pm.", source: "Shipping" },
        type: "tool_call",
      },
    ]),
    said("Done."),
    said("", [
      {
        id: "2",
        name: "write_report",
        args: { report: "The cutoff is 3 pm [1].\n[1] Shipping" },
        type: "tool_call",
      },
    ]),
  ]);
  const calls: string[] = [];
  const graph = researchGraph({
    model,
    checkpointer: new MemorySaver(),
    on: { tool: (name) => calls.push(name) },
  });
  const state = (await graph.invoke(
    { topic: "cutoffs" },
    { configurable: { thread_id: "t2" } },
  )) as ResearchState;
  expect(calls).toEqual(["save_finding", "write_report"]);
  expect(state.report).toContain("3 pm");
});
