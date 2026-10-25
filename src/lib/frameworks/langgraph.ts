import { randomUUID } from "node:crypto";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  type AIMessage,
  type BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  type StructuredToolInterface,
  tool as langchainTool,
} from "@langchain/core/tools";
import {
  Annotation,
  type BaseCheckpointSaver,
  END,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { config } from "../config";
import { type Usage, costOf } from "../providers";
import {
  type Events,
  type Researcher,
  defaultModel,
  instructions,
  maxSteps,
} from "./researcher";
import { type Finding, type Notebook, researchTools } from "./tools";

const none: Usage = { input: 0, output: 0 };
const add = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
});

/** The run as the graph carries it; each node reads it and returns the part it changes. */
const State = Annotation.Root({
  topic: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  findings: Annotation<Finding[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  report: Annotation<string>,
  calls: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
  usage: Annotation<Usage>({ reducer: add, default: () => none }),
});
export type ResearchState = typeof State.State;

const usageOf = (message: AIMessage): Usage => ({
  input: message.usage_metadata?.input_tokens ?? 0,
  output: message.usage_metadata?.output_tokens ?? 0,
});

const textOf = (message: AIMessage) =>
  typeof message.content === "string"
    ? message.content
    : message.content
        .filter((part) => part.type === "text")
        .map((part) => (part as { text: string }).text)
        .join("");

type Invokable = { invoke(messages: BaseMessage[]): Promise<BaseMessage> };
/** What the graph needs of a chat model: a call, and a call with tools bound; a test scripts one. */
export type ResearchModel = Invokable & {
  bindTools(
    tools: StructuredToolInterface[],
    options?: { tool_choice?: string },
  ): Invokable;
};

/**
 * The research agent as a graph: plan, then a research loop whose edge goes
 * back to the tools while the model calls them, then the report. The
 * checkpointer records the state after every node, so a run resumes from
 * its last node on the same thread.
 */
export function researchGraph({
  model,
  checkpointer,
  on,
}: {
  model: ResearchModel;
  checkpointer: BaseCheckpointSaver;
  on?: Events;
}) {
  const definitions = researchTools({ findings: [] }).map((t) =>
    langchainTool(async () => "", {
      name: t.name,
      description: t.description,
      schema: t.input,
    }),
  );
  const researcher = model.bindTools(
    definitions.filter((d) => d.name !== "write_report"),
  );
  const writer = model.bindTools(
    definitions.filter((d) => d.name === "write_report"),
    { tool_choice: "write_report" },
  );
  const system = new SystemMessage(instructions);

  const plan = async (state: ResearchState) => {
    const response = (await model.invoke([
      system,
      new HumanMessage(
        `Question: ${state.topic}\n\nBefore searching, say in 2 or 3 lines what to look for and where.`,
      ),
    ])) as AIMessage;
    on?.text?.(textOf(response));
    // The plan goes into the question's own message: a conversation that ends
    // on the assistant's turn reads as a prefill, which the small models refuse.
    return {
      messages: [
        new HumanMessage(`${state.topic}\n\nThe plan:\n${textOf(response)}`),
      ],
      usage: usageOf(response),
    };
  };

  const research = async (state: ResearchState) => {
    const response = (await researcher.invoke([
      system,
      ...state.messages,
    ])) as AIMessage;
    if (textOf(response)) on?.text?.(textOf(response));
    return { messages: [response], usage: usageOf(response) };
  };

  // The tools run here, against a notebook of this step's own, so what they
  // saved comes back as state and survives a resume.
  const tools = async (state: ResearchState) => {
    const last = state.messages.at(-1) as AIMessage;
    const notebook: Notebook = { findings: [] };
    const byName = new Map(researchTools(notebook).map((t) => [t.name, t]));
    const messages: ToolMessage[] = [];
    for (const call of last.tool_calls ?? []) {
      on?.tool?.(call.name, call.args);
      const content = await byName
        .get(call.name)!
        .run(call.args)
        .catch((error: Error) => `Error: ${error.message}`);
      messages.push(
        new ToolMessage({ content, tool_call_id: call.id!, name: call.name }),
      );
    }
    return {
      messages,
      findings: notebook.findings,
      calls: last.tool_calls?.length ?? 0,
    };
  };

  const write = async (state: ResearchState) => {
    const findings = state.findings
      .map((f, i) => `${i + 1}. ${f.text} (${f.source})`)
      .join("\n");
    const response = (await writer.invoke([
      system,
      ...state.messages,
      new HumanMessage(
        `Write the report now with write_report, from these findings:\n${findings || "none"}`,
      ),
    ])) as AIMessage;
    on?.tool?.("write_report", response.tool_calls?.[0]?.args);
    const report = String(
      response.tool_calls?.[0]?.args.report ?? textOf(response),
    );
    return { report, messages: [response], calls: 1, usage: usageOf(response) };
  };

  const next = (state: ResearchState) => {
    const last = state.messages.at(-1) as AIMessage;
    return last.tool_calls?.length && state.calls < maxSteps
      ? "tools"
      : "write";
  };

  return new StateGraph(State)
    .addNode("plan", plan)
    .addNode("research", research)
    .addNode("tools", tools)
    .addNode("write", write)
    .addEdge(START, "plan")
    .addEdge("plan", "research")
    .addConditionalEdges("research", next, ["tools", "write"])
    .addEdge("tools", "research")
    .addEdge("write", END)
    .compile({ checkpointer });
}

// Checkpoints live in Postgres when the app has one, so a thread outlives the
// process that started it; in memory otherwise.
let saver: Promise<BaseCheckpointSaver> | undefined;
export const checkpointer = () =>
  (saver ??= (async () => {
    if (!config.database.startsWith("postgres")) return new MemorySaver();
    const postgres = PostgresSaver.fromConnString(config.database);
    await postgres.setup();
    return postgres;
  })());

/** A run on a thread: a new one by default, or the given one continued from its last checkpoint. */
export const langgraph: Researcher = async (
  topic,
  { model = defaultModel(), on, thread = randomUUID() } = {},
) => {
  const graph = researchGraph({
    model: new ChatAnthropic({ model, maxTokens: 4096 }),
    checkpointer: await checkpointer(),
    on,
  });
  const at = { configurable: { thread_id: thread } };
  const started = Date.now();
  const before = (await graph.getState(at)).values as Partial<ResearchState>;
  const state = (await graph.invoke(
    before.topic ? null : { topic },
    at,
  )) as ResearchState;
  return {
    report: state.report,
    findings: state.findings,
    toolCalls: state.calls,
    usage: state.usage,
    dollars: costOf(model, state.usage),
    ms: Date.now() - started,
  };
};
