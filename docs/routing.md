# Routing: 2 providers, 1 codebase

Every model call in WorkBot names a task, not a model. `src/lib/routing.ts` maps each task to its route, a provider and a size, and to the routes that take over when the first cannot answer. Ids and prices stay in `src/lib/providers.ts`. The table below is what `pnpm routes` measured on 2026-10-25, and the routing after it is what the table decided.

## Where the providers differ

The terminal session (`src/lib/providers.ts`) speaks both wire formats directly, so the differences are in one file:

| Concern           | Anthropic Messages                                                                                                                                                                               | OpenAI Responses                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| System prompt     | `system`, beside `messages`                                                                                                                                                                      | `instructions`, beside `input`                                                                      |
| A tool call       | a `tool_use` block in the assistant message; the turn ends with `stop_reason: "tool_use"`                                                                                                        | a `function_call` item in the output; the turn ends when no item is a call                          |
| A tool result     | a `tool_result` block in the next user message, `is_error` when the tool failed                                                                                                                  | a `function_call_output` item, after the model's own items (message, call, reasoning) are replayed  |
| Streaming         | events per content block; the SDK's stream helper hands out text deltas and the final message                                                                                                    | `response.output_text.delta`, then `response.completed`, `response.incomplete` or `response.failed` |
| Reasoning         | `output_config.effort`                                                                                                                                                                           | `reasoning.effort`; reasoning items go back on the next turn or the model loses its thread          |
| Tokens            | `input_tokens`, `output_tokens`, and cache reads and writes as fields of their own                                                                                                               | `input_tokens`, `output_tokens`; cached tokens under the input details                              |
| Prompt caching    | explicit: `cache_control` on a block, 1.25× the input price to write, 0.1× to read (0.05× on Sonnet), as published on 2026-10-25                                                                 | automatic on a repeated prefix                                                                      |
| Structured output | a schema the model is held to through the AI SDK's `Output.object`; each provider enforces it with its own strictness, and a feature one lacks shows up as a retry in the Day 17 extraction loop | the same                                                                                            |

The AI SDK hides the first 6 rows behind `generateText` and `streamText`. The last 2 leak: the chat route sets `providerOptions.anthropic.cacheControl` on its system prompt, and strictness is the provider's.

## The layer

- `aiModel(provider, id)`: the provider package's model, traced (Day 19). When `OUTAGE` names the provider or the model, every call fails before the network with a 503, as the provider's own would.
- `modelOf(route)`: the model a route names, `anthropic/small` for one.
- `routes`: the table, a task to its routes in order.
- `chain(models)`: models in order; a call the first cannot take goes to the second with the same parameters. The chain is middleware: `wrapGenerate` and `wrapStream` catch the first model's failure and call the next model's `doGenerate` or `doStream`.
- `modelFor(task)`: the task's chain, with `ROUTES` from the environment replacing the first model when set (`ROUTES=chat=anthropic/small` on a development machine).

What a call cannot take over: a failure that would fail anywhere. The check is the AI SDK's own `APICallError.isRetryable`: 5xx, 429, 408 and a connection that could not be made are transient; 400 and 401 are not. A stream that fails after it has started is not retried elsewhere either, because part of the reply is already on the page.

## What the person sees

| What failed                                          | What happens                                                                                             | What the person sees                                                                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The first model is down, unreachable or rate-limited | the call fails at once and the next model in the route answers                                           | the answer, one failed call later than usual at each step of the turn: 0 ms when rehearsed, the provider's time to refuse when real |
| The model refuses                                    | nothing: a refusal is an answer, and the golden set holds refusals the assistant must make               | the refusal                                                                                                                         |
| Every model in the route is down                     | the last error reaches the route, which sends one sentence and keeps the provider's error for the traces | "WorkBot cannot reach its model right now. Try again in a minute." and a Retry button, with the message still on the page           |
| A bad key or an invalid request                      | no fallback; the error is recorded and the hourly watch alerts when the error rate passes 10%            | the same sentence                                                                                                                   |

`OUTAGE=claude-haiku-5-5 pnpm dev` rehearses the first row, with the chat falling to Sonnet; `OUTAGE=anthropic pnpm dev` the third. The traces page shows both calls of a fallback: the failed one with its reason, the one that answered with its cost.

## The table

`pnpm routes --runs 2`, 2026-10-25. Score is the mean over the task's cases and runs; SD its standard deviation; cost is the bill per case from the traces of the run, at the published prices; p95 is the 95th percentile of a model call's latency, in milliseconds; calls is how many the task made.

| Task    | Route           | Score  | SD   | $/case  | p95 ms | Calls |
| ------- | --------------- | ------ | ---- | ------- | ------ | ----- |
| chat    | anthropic/small | 0.83   | 0.26 | $0.0008 | 3373   | 76    |
| chat    | anthropic/large | 0.87   | 0.25 | $0.0171 | 4803   | 77    |
| chat    | openai/small    | no key |      |         |        |       |
| chat    | openai/large    | no key |      |         |        |       |
| extract | anthropic/small | 0.96   | 0.10 | $0.0006 | 3965   | 72    |
| extract | anthropic/large | 0.97   | 0.09 | $0.0096 | 3956   | 72    |
| extract | openai/small    | no key |      |         |        |       |
| extract | openai/large    | no key |      |         |        |       |
| triage  | anthropic/small | 0.96   | 0.14 | $0.0001 | 1891   | 24    |
| triage  | anthropic/large | 0.96   | 0.14 | $0.0019 | 2121   | 24    |
| triage  | openai/small    | no key |      |         |        |       |
| triage  | openai/large    | no key |      |         |        |       |

Re-judged by Sonnet (`ROUTES=judge=anthropic/large pnpm routes --task chat --runs 1`), the chat rows came out 0.91 for the small model and 0.88 for the large, SD 0.18: the order flips and the gap stays inside the noise. The 2 runs cost $1.26 in all, judge included.

Chat is 14 golden cases scored by the judge on Haiku, SD 0.25 over 28 scored answers. Extraction is the 18 eval documents, scored as the share of expected fields that came out right, 0 when the kind was wrong. Triage is 12 messages, scored on team and priority, half each. The OpenAI rows have no key on this run; `OPENAI_API_KEY` in `.env.local` and `pnpm routes --provider openai` fill them.

## The routing chosen

`routes` in `src/lib/routing.ts`, one row per task, the first model and the one behind it:

| Task      | Route              | Why                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| chat      | small, then large  | Both judges put the 2 models within noise on the 14 cases (0.83 against 0.87 under Haiku, 0.91 against 0.88 under Sonnet) at a twentieth of the price a turn and a lower p95. Sonnet stands behind it, and the row is revisited when the golden set can tell them apart, which is Day 25's work.                                        |
| generate  | large, then small  | A page laid out from live numbers has no eval yet, so it stays on the model that writes until it is measured. The small model behind it keeps pages coming through an outage; the catalog validates the output either way.                                                                                                              |
| research  | large, then small  | The analyst already delegates its reading to specialists on the small model; its own work is deciding what to ask and writing the report, which no eval scores yet. The small model behind it files a report on time rather than none.                                                                                                  |
| summarize | small, then large  | The summary of dropped history is read by the model, not by a person, and the small model has written it since Day 11. The large model behind it costs 20 times as much on the rare turn that needs it, which is nothing a day.                                                                                                         |
| extract   | small, then large  | 0.96 against 0.97 on the 18 documents at a sixteenth of the price, with PDFs and images read alike. A doubtful field goes to a reviewer (Day 17), so the small model's rare miss meets a person, and the large model behind it only keeps the inbox moving.                                                                             |
| triage    | small, then large  | Equal at 0.96 on the 12 cases, at a nineteenth of the price and the lowest p95 in the table. The large model behind it keeps intake filing requests.                                                                                                                                                                                    |
| read      | small, then large  | Frames, pages and the knowledge base are read at volume, and extraction, the nearest measured task, shows no gap between the models. The large model behind it is what keeps a recording readable when the small one is down.                                                                                                           |
| judge     | large, no fallback | A judge must not be the model under test: with the chat on the small model, the judge is the large one (Day 25), and it agreed with a person on 20 of 20 hand-labeled replies. An eval whose judge is down fails loudly rather than mixing judges in one table, since the check with Sonnet as judge moved the chat rows by up to 0.08. |

`ROUTES` moves a first model per environment without touching the table; the development machines here run `ROUTES=generate=anthropic/small,research=anthropic/small`.

## The second provider

The layer runs OpenAI today: `modelOf("openai/large")` is `gpt-5.5` behind the same tracing, and the terminal's `--provider openai` has run it since Day 5. It is in no route because the table has no column for it, and a route is a measurement, not a preference. When the column fills, a row gains a third entry on the other provider where its score is within the judge's noise of the first and its p95 within the task's budget; a provider outage then becomes a slower answer rather than the sentence. An open-weight model served by an inference provider enters the same way: one more provider in `providers.ts` behind the same interface, one more column, and the same evals decide whether a route can use it; where it fits (on-premise, data residency, cost at volume) is the business's question, not the table's.
