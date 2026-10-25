# The research agent on 3 frameworks

The same agent, with the same 4 tools and the same instructions, built on LangGraph.js, the Claude Agent SDK and the OpenAI Agents SDK, and run on 5 questions against the knowledge base on the small model. `pnpm frameworks` reruns it; the code is under `src/lib/frameworks/`.

## The runs

| Topic    | Framework | Time | Tool calls | Tokens in / out | Cost   | Findings |
| -------- | --------- | ---- | ---------- | --------------- | ------ | -------- |
| refunds  | langgraph | 28 s | 18         | 33365 / 5043    | $0.006 | 5        |
| refunds  | claude    | 21 s | 15         | 272487 / 3241   | $0.006 | 6        |
| refunds  | openai    | 17 s | 16         | 24280 / 2425    | $0.004 | 4        |
| shipping | langgraph | 17 s | 14         | 17288 / 3060    | $0.003 | 5        |
| shipping | claude    | 17 s | 11         | 270224 / 2745   | $0.005 | 4        |
| shipping | openai    | 16 s | 11         | 18192 / 1992    | $0.003 | 4        |
| vendors  | langgraph | 22 s | 15         | 32118 / 3922    | $0.005 | 6        |
| vendors  | claude    | 16 s | 11         | 270815 / 2775   | $0.005 | 4        |
| vendors  | openai    | 18 s | 13         | 19556 / 2495    | $0.003 | 6        |
| invoices | langgraph | 20 s | 18         | 19175 / 3871    | $0.004 | 7        |
| invoices | claude    | 18 s | 18         | 272874 / 3456   | $0.005 | 7        |
| invoices | openai    | 17 s | 17         | 22011 / 3343    | $0.004 | 7        |
| support  | langgraph | 28 s | 16         | 38699 / 5539    | $0.007 | 4        |
| support  | claude    | 19 s | 15         | 272819 / 3407   | $0.005 | 5        |
| support  | openai    | 25 s | 11         | 19688 / 2235    | $0.003 | 3        |

- langgraph: 5 runs, 23 s and 16.2 tool calls a run, $0.025 in all
- claude: 5 runs, 18 s and 14.0 tool calls a run, $0.026 in all
- openai: 5 runs, 19 s and 13.6 tool calls a run, $0.017 in all

The tokens column counts every token sent, cached or not. The Claude Agent SDK carries Claude Code's own context into each turn, about 15,000 tokens, read from the cache at a tenth of the price: 270,000 input tokens a run that cost the same as LangGraph's 30,000.

Time and tokens differ more by run than by framework: the model decides how much to read, and a run that reads 3 documents costs 3 times one that reads 1. What a framework adds is in the tokens of its own prompts and tool descriptions, and in the calls it makes on its own.

## What each made easier, and harder

**LangGraph.js.** Easier: the run is a typed state with reducers, so every node returns only what it changed, and the checkpointer saves it after each node; a killed run continues on its thread from the last node, and a test scripts the model to prove it. The graph draws itself, which is the diagram the design document needs. Harder: more code than the loop it replaces, about 160 lines against 90, because the tools node is written by hand so that what the tools save lands in state; a state field and a node cannot share a name; a conversation that ends on the assistant's turn is a prefill to the API, which the small models refuse, so the plan has to be folded into the user's message.

**Claude Agent SDK.** Easier: the least code, about 60 lines. The tools become an in-process MCP server, the loop, its context management and its cost accounting are the SDK's, and a hook sees every tool call. Harder: each run is a Claude Code process, with its own session and settings; the built-in tools have to be switched off for an agent that should not touch files; the loop's only stop is `maxTurns`, so a step or dollar limit of your own needs a hook.

**OpenAI Agents SDK.** Easier: handoffs and guardrails are primitives. The Writer is one line in the Researcher's definition and the model transfers to it with a tool; the remit guardrail is a function that runs before any model call and refuses with a typed error. Usage comes back per run. Harder: the AI SDK adapter is beta; it ran an Anthropic model, tools and the handoff without incident, but tracing stays tied to OpenAI's backend; a small model has to be told in plain words to transfer rather than write the report itself.

## The choice

WorkBot's agents keep the loop from Day 12: 90 lines the product owns, with its own limits, cost ledger and events, and nothing to upgrade. Two frameworks have a place beside it:

- The Claude Agent SDK runs the terminal explainer from Day 7 and stays there: it is what Claude Code runs on, so its hooks, permissions and MCP tools match the tooling the team already uses.
- LangGraph.js is the framework for the first agent that needs to pause for a person and resume later, which is the research analyst once it files on a ticket. The 2 reasons: its checkpoints live in the Postgres the app already has, and its graph is testable with a scripted model and drawable for the design document.

The OpenAI Agents SDK is not adopted: WorkBot runs on Anthropic models, and the adapter that makes that possible is beta; its handoffs and guardrails are the pattern to copy, not the dependency to take.
