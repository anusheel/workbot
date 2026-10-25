import {
  type HookCallback,
  type HookInput,
  type Options,
  type SDKMessage,
  createSdkMcpServer,
  query,
  tool as sdkTool,
} from "@anthropic-ai/claude-agent-sdk";
import { knowledgeTools } from "./knowledge-tools";
import type { Tool } from "./tool";

export type TraceEvent = {
  at: Date;
  agent: string;
  event: "call" | "result";
  tool: string;
  detail: string;
};
export type ExplainerEvents = {
  trace?(event: TraceEvent): void;
  text?(text: string): void;
};
export type Run = (params: {
  prompt: string;
  options?: Options;
}) => AsyncIterable<SDKMessage>;

/** A registry tool as the Agent SDK takes it: the same schema and function, served over MCP in-process. */
const asSdkTool = (t: Tool) =>
  sdkTool(t.name, t.description, t.input.shape, async (args) => ({
    content: [{ type: "text", text: await t.run(args) }],
  }));

const knowledge = createSdkMcpServer({
  name: "knowledge",
  tools: knowledgeTools().map(asSdkTool),
});

export const agents: Options["agents"] = {
  researcher: {
    description:
      "Gathers the facts that answer a customer's question from the company's policies, each with its source.",
    prompt:
      "You are the researcher for a customer reply at Fieldstone Supply. Call find with the question, then cat each document that matters; grep when you need an exact number. Reply with a list of facts, one per line starting with a dash, each ending with its source in brackets, for example [Customer refunds]. A fact without a source is not a fact; leave it out. Nothing else.",
    tools: knowledgeTools().map((t) => `mcp__knowledge__${t.name}`),
    model: "haiku",
  },
  writer: {
    description:
      "Writes the reply to the customer from the researcher's facts, and revises it from the editor's edits.",
    prompt:
      "You write replies to Fieldstone Supply's customers. From the question and the facts, write the reply: 2 to 5 short paragraphs, plain words, numerals for numbers, warm and direct. Use only the facts you were given, and say what the customer can do next. When you are given edits, apply every one of them. Reply with the customer reply only.",
    tools: [],
    model: "sonnet",
  },
  editor: {
    description:
      "Checks a customer reply for accuracy and safety before it goes out.",
    prompt:
      "You are the safety editor for replies to Fieldstone Supply's customers. Check the draft against the facts: every claim must trace to a fact; no promise beyond policy (no refund, date or exception the facts do not grant); nothing about other people; no blame; a respectful tone. If it passes, reply APPROVED on the first line and nothing else. Otherwise reply REVISE on the first line, then numbered edits: quote the sentence and say what to change.",
    tools: [],
    model: "sonnet",
  },
};

const orchestrator = `You run WorkBot's explainer pipeline for a question from a Fieldstone Supply customer.
1. Run the researcher agent with the question.
2. Run the writer agent with the question and the researcher's facts.
3. Run the editor agent with the facts and the draft.
4. If the editor says REVISE, run the writer again with the draft and the editor's edits, then the editor again. At most 2 revisions.
When the editor approves, reply with APPROVED on the first line, then the final customer reply and nothing else. If the editor still asks for revisions after the second one, reply with NOT APPROVED on the first line, then the latest draft, then the editor's remaining edits; a person finishes it.`;

// Every fact the researcher lists must end with its source in brackets.
const fact = /^\s*(?:[-*]|\d+[.)])\s/;
const sourced = /\[[^\]]+\]\s*$/;
const numbered = /^\s*\d+[.)]\s/m;
const text = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value ?? "");

/** Subagents run in the foreground, so the orchestrator gets their result rather than a task to wait for. */
export const foreground: HookCallback = async (input) => {
  if (input.hook_event_name !== "PreToolUse" || input.tool_name !== "Agent")
    return {};
  const tool_input = input.tool_input as Record<string, unknown>;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { ...tool_input, run_in_background: false },
    },
  };
};

/** Guardrails as code: a subagent's output is checked before the orchestrator may act on it. */
export const guardrail: HookCallback = async (input) => {
  if (input.hook_event_name !== "PostToolUse" || input.tool_name !== "Agent")
    return {};
  const { subagent_type: agent } = input.tool_input as {
    subagent_type?: string;
  };
  const output = text(input.tool_response);
  const facts = output.split("\n").filter((line) => fact.test(line));
  if (
    agent === "researcher" &&
    (facts.length === 0 || !facts.every((line) => sourced.test(line)))
  ) {
    return {
      decision: "block",
      reason:
        "The researcher gave facts without sources. Run it again and require a source in brackets at the end of every fact.",
    };
  }
  if (
    agent === "editor" &&
    /^\s*REVISE/.test(output) &&
    !numbered.test(output)
  ) {
    return {
      decision: "block",
      reason:
        "The editor asked for revisions without listing them. Run it again and require numbered, specific edits.",
    };
  }
  return {};
};

function describe(input: HookInput): TraceEvent | undefined {
  if (
    input.hook_event_name !== "PreToolUse" &&
    input.hook_event_name !== "PostToolUse"
  )
    return undefined;
  const call = input.hook_event_name === "PreToolUse";
  const { subagent_type } = (input.tool_input ?? {}) as {
    subagent_type?: string;
  };
  const tool =
    input.tool_name === "Agent" && subagent_type
      ? `agent:${subagent_type}`
      : input.tool_name;
  const detail = call
    ? text(input.tool_input).slice(0, 160)
    : `${text(input.tool_response).length} characters`;
  return {
    at: new Date(),
    agent: input.agent_type ?? "orchestrator",
    event: call ? "call" : "result",
    tool,
    detail,
  };
}

/**
 * The explainer pipeline: researcher, writer and safety editor as subagents,
 * run by an orchestrator that sends drafts back for revision. Each tool call
 * and handoff is traced; guardrails reject a researcher without sources and an
 * editor without specific edits. A draft the editor never approved comes back
 * marked, for a person to finish.
 */
export async function explain(
  question: string,
  on: ExplainerEvents = {},
  run: Run = query,
  model?: string,
) {
  const trace: TraceEvent[] = [];
  const record: HookCallback = async (input) => {
    const event = describe(input);
    if (event) {
      trace.push(event);
      on.trace?.(event);
    }
    return {};
  };
  // One model for everything when asked (a small one while testing); otherwise each agent's own.
  const cast = model
    ? Object.fromEntries(
        Object.entries(agents!).map(([name, agent]) => [
          name,
          { ...agent, model },
        ]),
      )
    : agents;
  const options: Options = {
    systemPrompt: orchestrator,
    agents: cast,
    mcpServers: { knowledge },
    allowedTools: ["Agent", "mcp__knowledge__*"],
    permissionMode: "bypassPermissions",
    maxTurns: 24,
    model: model ?? "sonnet",
    hooks: {
      PreToolUse: [
        { matcher: "Agent", hooks: [foreground] },
        { hooks: [record] },
      ],
      PostToolUse: [{ hooks: [record, guardrail] }],
    },
  };

  // The orchestrator's last words are the result itself, so each text block
  // is narrated once the next one arrives, and the final one is not repeated.
  let pending: string | undefined;
  for await (const message of run({ prompt: question, options })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type !== "text") continue;
        if (pending) on.text?.(pending);
        pending = block.text;
      }
    }
    if (message.type === "result") {
      if (message.subtype !== "success")
        throw new Error(`The pipeline ended with ${message.subtype}.`);
      if (pending && pending.trim() !== message.result.trim())
        on.text?.(pending);
      const [verdict, ...rest] = message.result.split("\n");
      const approved = verdict.trim() === "APPROVED";
      const reply = (approved ? rest.join("\n") : message.result).trim();
      return {
        approved,
        reply,
        trace,
        cost: message.total_cost_usd,
        turns: message.num_turns,
      };
    }
  }
  throw new Error("The pipeline ended without a result.");
}
