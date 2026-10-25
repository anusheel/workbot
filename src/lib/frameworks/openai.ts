import { anthropic } from "@ai-sdk/anthropic";
import {
  Agent,
  type InputGuardrail,
  InputGuardrailTripwireTriggered,
  run,
  setTracingDisabled,
  tool as agentTool,
} from "@openai/agents";
import { aisdk } from "@openai/agents-extensions/ai-sdk";
import { costOf } from "../providers";
import {
  type Researcher,
  defaultModel,
  instructions,
  maxSteps,
} from "./researcher";
import { type Notebook, researchTools } from "./tools";

// The SDK's traces go to OpenAI's backend, which takes an OpenAI key; a
// processor of our own could send them to the traces table instead.
setTracingDisabled(true);

/** The research desk's remit: a question that names none of these is refused before any model call. */
export const remit = [
  "order",
  "shipping",
  "deliver",
  "return",
  "refund",
  "invoice",
  "payment",
  "vendor",
  "supplier",
  "warranty",
  "support",
  "incident",
  "policy",
  "expense",
  "travel",
  "leave",
  "onboarding",
  "warehouse",
  "inventory",
  "safety",
];

const inRemit: InputGuardrail = {
  name: "Topic in the research desk's remit",
  runInParallel: false,
  execute: async ({ input }) => {
    const text = (
      typeof input === "string" ? input : JSON.stringify(input)
    ).toLowerCase();
    const matched = remit.filter((word) => text.includes(word));
    return { outputInfo: { matched }, tripwireTriggered: matched.length === 0 };
  },
};

export const refused = (error: unknown) =>
  error instanceof InputGuardrailTripwireTriggered;

/**
 * The research agent on the OpenAI Agents SDK, on an Anthropic model through
 * the AI SDK adapter: a Researcher with the search, read and save tools hands
 * off to a Writer that holds write_report, behind a guardrail on the topic.
 */
export const openai: Researcher = async (
  topic,
  { model = defaultModel(), on } = {},
) => {
  const notebook: Notebook = { findings: [] };
  const [search, read, save, write] = researchTools(notebook).map((t) =>
    agentTool({
      name: t.name,
      description: t.description,
      parameters: t.input,
      execute: (input) => {
        on?.tool?.(t.name, input);
        return t.run(input);
      },
    }),
  );
  const llm = aisdk(anthropic(model));
  const writer = new Agent({
    name: "Writer",
    handoffDescription: "Writes the report once the findings are in.",
    instructions: `You write the report for the research desk. From the findings in the conversation, call write_report once: the answer in plain sentences, each fact followed by its source in brackets, then a line per source. Then reply with the report.`,
    tools: [write],
    model: llm,
  });
  const researcher = Agent.create({
    name: "Researcher",
    instructions: `${instructions} You do not write the report yourself: when the findings answer the question, transfer the conversation to the Writer, who has write_report.`,
    tools: [search, read, save],
    handoffs: [writer],
    inputGuardrails: [inRemit],
    model: llm,
  });
  const started = Date.now();
  const result = await run(researcher, topic, { maxTurns: maxSteps });
  for (const item of result.newItems)
    if (item.type === "message_output_item")
      on?.text?.(
        item.rawItem.content
          .filter((part) => part.type === "output_text")
          .map((part) => part.text)
          .join(""),
      );
  const { usage } = result.state;
  const spend = { input: usage.inputTokens, output: usage.outputTokens };
  return {
    report: notebook.report ?? String(result.finalOutput ?? ""),
    findings: notebook.findings,
    toolCalls: result.newItems.filter((item) => item.type === "tool_call_item")
      .length,
    usage: spend,
    dollars: costOf(model, spend),
    ms: Date.now() - started,
  };
};
