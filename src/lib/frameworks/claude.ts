import {
  type HookCallback,
  createSdkMcpServer,
  query,
  tool as sdkTool,
} from "@anthropic-ai/claude-agent-sdk";
import { costOf } from "../providers";
import {
  type Researcher,
  defaultModel,
  instructions,
  maxSteps,
} from "./researcher";
import { type Notebook, researchTools } from "./tools";

const server = "research";

/**
 * The research agent on the Claude Agent SDK: the tools as an in-process MCP
 * server, the loop and its context management the SDK's, a hook that sees
 * every tool call before it runs.
 */
export const claude: Researcher = async (
  topic,
  { model = defaultModel(), on } = {},
) => {
  const notebook: Notebook = { findings: [] };
  const tools = researchTools(notebook).map((t) =>
    sdkTool(t.name, t.description, t.input.shape, async (input) => ({
      content: [{ type: "text" as const, text: await t.run(input) }],
    })),
  );
  let calls = 0;
  const log: HookCallback = async (input) => {
    if (input.hook_event_name === "PreToolUse") {
      calls += 1;
      on?.tool?.(
        input.tool_name.replace(`mcp__${server}__`, ""),
        input.tool_input,
      );
    }
    return {};
  };
  const started = Date.now();
  let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for await (const message of query({
    prompt: topic,
    options: {
      systemPrompt: instructions,
      model,
      tools: [],
      mcpServers: {
        [server]: createSdkMcpServer({ name: server, version: "1.0.0", tools }),
      },
      allowedTools: [`mcp__${server}__*`],
      permissionMode: "bypassPermissions",
      maxTurns: maxSteps,
      hooks: { PreToolUse: [{ hooks: [log] }] },
    },
  })) {
    if (message.type === "assistant")
      for (const part of message.message.content)
        if (part.type === "text") on?.text?.(part.text);
    if (message.type === "result")
      usage = {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
        cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      };
  }
  return {
    report: notebook.report ?? "",
    findings: notebook.findings,
    toolCalls: calls,
    // The SDK caches the prompt, so most of the input is cache reads and
    // writes; the tokens column counts them all, the price counts them at their rates.
    usage: {
      input: usage.input + usage.cacheRead + usage.cacheWrite,
      output: usage.output,
    },
    dollars: costOf(model, usage),
    ms: Date.now() - started,
  };
};
