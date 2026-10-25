import type { HookInput, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { expect, test } from "vitest";
import { type Run, agents, explain, foreground, guardrail } from "./explainer";

const scripted = (messages: unknown[]): Run =>
  async function* () {
    yield* messages as SDKMessage[];
  };

const hook = (tool_input: unknown, tool_response: unknown): HookInput =>
  ({
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    tool_input,
    tool_response,
    tool_use_id: "t",
    session_id: "s",
    cwd: "/",
  }) as HookInput;
const context = { signal: new AbortController().signal };

test("the pipeline is 3 subagents on 2 model sizes, run by an orchestrator that returns the approved reply", async () => {
  let prompt = "";
  let options: Parameters<Run>[0]["options"];
  const run: Run = (params) => {
    prompt = params.prompt;
    options = params.options;
    return scripted([
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Running the researcher." }],
        },
      },
      {
        type: "result",
        subtype: "success",
        result: "APPROVED\nYour refund of $200 is on its way.",
        total_cost_usd: 0.012,
        num_turns: 6,
      },
    ])(params);
  };
  const narration: string[] = [];
  const result = await explain(
    "Why was my refund only $200?",
    { text: (t) => narration.push(t) },
    run,
  );

  expect(result).toMatchObject({
    approved: true,
    reply: "Your refund of $200 is on its way.",
    cost: 0.012,
    turns: 6,
  });
  expect(narration).toEqual(["Running the researcher."]);
  expect(prompt).toBe("Why was my refund only $200?");
  expect(Object.keys(agents!)).toEqual(["researcher", "writer", "editor"]);
  expect(agents!.researcher.model).toBe("haiku");
  expect(agents!.writer.model).toBe("sonnet");
  expect(options?.allowedTools).toContain("Agent");
  expect(options?.mcpServers).toHaveProperty("knowledge");
  expect(options?.hooks?.PreToolUse?.[0]).toEqual({
    matcher: "Agent",
    hooks: [foreground],
  });
  expect(options?.hooks?.PostToolUse?.[0].hooks).toContain(guardrail);
});

test("a draft the editor never approved comes back marked, for a person to finish", async () => {
  const result = await explain(
    "?",
    {},
    scripted([
      {
        type: "result",
        subtype: "success",
        result: "NOT APPROVED\nDraft…\n1. Remove the promise.",
        total_cost_usd: 0.02,
        num_turns: 9,
      },
    ]),
  );
  expect(result.approved).toBe(false);
  expect(result.reply).toBe("NOT APPROVED\nDraft…\n1. Remove the promise.");
});

test("a pipeline that ends in an error is reported", async () => {
  await expect(
    explain(
      "?",
      {},
      scripted([{ type: "result", subtype: "error_max_turns", num_turns: 24 }]),
    ),
  ).rejects.toThrow("ended with error_max_turns");
});

test("the guardrails send back a researcher with any unsourced fact, and a vague editor", async () => {
  const researcher = { subagent_type: "researcher" };
  expect(
    await guardrail(
      hook(researcher, "- Refunds go up to $200 per order."),
      "t",
      context,
    ),
  ).toMatchObject({ decision: "block" });
  expect(
    await guardrail(
      hook(
        researcher,
        "- Refunds go up to $200 per order. [Customer refunds]\n- Store credit up to $300.",
      ),
      "t",
      context,
    ),
  ).toMatchObject({ decision: "block" });
  expect(
    await guardrail(
      hook(
        researcher,
        "Facts:\n- Refunds go up to $200 per order. [Customer refunds]\n- Store credit up to $300. [Customer refunds]",
      ),
      "t",
      context,
    ),
  ).toEqual({});

  const editor = { subagent_type: "editor" };
  expect(
    await guardrail(hook(editor, "REVISE\nIt is not good."), "t", context),
  ).toMatchObject({ decision: "block" });
  expect(
    await guardrail(
      hook(editor, "REVISE\n1. Replace 'any time' with 'within 30 days'."),
      "t",
      context,
    ),
  ).toEqual({});
  expect(await guardrail(hook(editor, "APPROVED"), "t", context)).toEqual({});
  expect(
    await guardrail(
      hook({ subagent_type: "writer" }, "Dear customer"),
      "t",
      context,
    ),
  ).toEqual({});
});

test("subagents are forced into the foreground", async () => {
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: "Agent",
    tool_input: {
      subagent_type: "writer",
      prompt: "Draft it",
      run_in_background: true,
    },
    tool_use_id: "t",
    session_id: "s",
    cwd: "/",
  } as HookInput;
  expect(await foreground(input, "t", context)).toEqual({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: {
        subagent_type: "writer",
        prompt: "Draft it",
        run_in_background: false,
      },
    },
  });
  expect(
    await foreground(
      { ...input, tool_name: "Read" } as HookInput,
      "t",
      context,
    ),
  ).toEqual({});
});
