import { AsyncLocalStorage } from "node:async_hooks";
import type {
  LanguageModelV4,
  LanguageModelV4Middleware,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";
import { io } from "next/cache";
import { query } from "./db";
import { costOf } from "./providers";

/** Who a model call is for and what it is doing: set once per request, read by every call inside it. */
export type Context = { tenant: string; name: string; prompt?: string };

export type Trace = Context & {
  id: string;
  at: Date;
  model: string;
  input: number;
  output: number;
  cached: number;
  dollars: number;
  ms: number;
  ok: boolean;
  error: string | null;
};

const context = new AsyncLocalStorage<Context>();
const fallback: Context = { tenant: "system", name: "call" };

/** Runs `fn` with every model call inside it attributed to the context. */
export const withTrace = <T>(ctx: Context, fn: () => Promise<T>) =>
  context.run(ctx, fn);
export const currentContext = (): Context => context.getStore() ?? fallback;

const columns = `id, at, tenant, name, prompt, model, input, output, cached, dollars, ms, ok, error`;

export async function recordTrace(
  trace: Omit<Trace, "id" | "at">,
): Promise<void> {
  await query(
    `insert into traces (tenant, name, prompt, model, input, output, cached, dollars, ms, ok, error) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      trace.tenant,
      trace.name,
      trace.prompt ?? null,
      trace.model,
      trace.input,
      trace.output,
      trace.cached,
      trace.dollars,
      trace.ms,
      trace.ok,
      trace.error,
    ],
  );
}

const dollarsOf = (
  model: string,
  usage: LanguageModelV4Usage | undefined,
  output: number,
) => {
  const total = usage?.inputTokens.total ?? 0;
  const cacheRead = usage?.inputTokens.cacheRead ?? 0;
  const cacheWrite = usage?.inputTokens.cacheWrite ?? 0;
  const input = usage?.inputTokens.noCache ?? total - cacheRead - cacheWrite;
  return costOf(model, { input, output, cacheRead, cacheWrite });
};

async function record(
  ctx: Context,
  model: string,
  started: number,
  usage?: LanguageModelV4Usage,
  error?: unknown,
) {
  const input = usage?.inputTokens.total ?? 0;
  const output = usage?.outputTokens.total ?? 0;
  const cached = usage?.inputTokens.cacheRead ?? 0;
  await recordTrace({
    ...ctx,
    model,
    input,
    output,
    cached,
    dollars: dollarsOf(model, usage, output),
    ms: Date.now() - started,
    ok: error === undefined,
    error:
      error === undefined
        ? null
        : error instanceof Error
          ? error.message
          : String(error),
  }).catch((err: unknown) => console.error("[tracing]", err));
}

/**
 * Every call to the model, recorded: tokens, cached tokens, dollars, latency
 * and whether it failed, under the request's tenant and name. The call
 * itself is unchanged; the record is written as the reply ends.
 */
export function traced(model: LanguageModelV4): LanguageModelV4 {
  const middleware: LanguageModelV4Middleware = {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate, model }) => {
      const ctx = currentContext();
      const started = Date.now();
      try {
        const result = await doGenerate();
        await record(ctx, model.modelId, started, result.usage);
        return result;
      } catch (error) {
        await record(ctx, model.modelId, started, undefined, error);
        throw error;
      }
    },
    wrapStream: async ({ doStream, model }) => {
      const ctx = currentContext();
      const started = Date.now();
      let result: Awaited<ReturnType<typeof doStream>>;
      try {
        result = await doStream();
      } catch (error) {
        await record(ctx, model.modelId, started, undefined, error);
        throw error;
      }
      const { stream, ...rest } = result;
      let usage: LanguageModelV4Usage | undefined;
      let failure: unknown;
      let written = false;
      // A trace is written once, whichever of end, error or cancel comes first.
      const finish = (error?: unknown) => {
        if (written) return Promise.resolve();
        written = true;
        return record(ctx, model.modelId, started, usage, error);
      };
      const reader = stream.getReader();
      return {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                await finish(failure);
                controller.close();
                return;
              }
              if (value.type === "finish") usage = value.usage;
              if (value.type === "error") failure = value.error;
              controller.enqueue(value);
            } catch (error) {
              await finish(error);
              controller.error(error);
            }
          },
          async cancel(reason) {
            await finish(reason ?? new Error("stream cancelled"));
            await reader.cancel(reason);
          },
        }),
        ...rest,
      };
    },
  };
  return wrapLanguageModel({ model, middleware });
}

/** The calls under a context since a moment: how many, what they cost, and the p95 of their latency. */
export async function spend(ctx: Context, since: Date) {
  const [row] = await query<{
    calls: number;
    dollars: number;
    p95: number | null;
  }>(
    `select count(*)::int as calls, coalesce(sum(dollars), 0)::float as dollars,
       percentile_cont(0.95) within group (order by ms) as p95
     from traces where tenant = $1 and name = $2 and prompt is not distinct from $3 and at >= $4`,
    [ctx.tenant, ctx.name, ctx.prompt ?? null, since],
  );
  return { ...row, p95: Math.round(row.p95 ?? 0) };
}

export type Summary = {
  calls: number;
  errors: number;
  dollars: number;
  cached: number;
  p50: number;
  p95: number;
  byTenant: { tenant: string; calls: number; dollars: number }[];
  byPrompt: { prompt: string; calls: number; dollars: number; p50: number }[];
  recent: Trace[];
};

/** The last `hours` of model calls, as a dashboard reads them. */
export async function traceSummary(hours: number): Promise<Summary> {
  await io();
  const since = [`now() - make_interval(hours => $1)`, [hours]] as const;
  const [totals] = await query<{
    calls: number;
    errors: number;
    dollars: number;
    cached: number;
    p50: number | null;
    p95: number | null;
  }>(
    `select count(*)::int as calls, count(*) filter (where not ok)::int as errors, coalesce(sum(dollars), 0)::float as dollars, coalesce(sum(cached), 0)::int as cached,
       percentile_cont(0.5) within group (order by ms) as p50, percentile_cont(0.95) within group (order by ms) as p95
     from traces where at > ${since[0]}`,
    [...since[1]],
  );
  const byTenant = await query<Summary["byTenant"][number]>(
    `select tenant, count(*)::int as calls, sum(dollars)::float as dollars from traces where at > ${since[0]} group by tenant order by dollars desc limit 10`,
    [...since[1]],
  );
  const byPrompt = await query<Summary["byPrompt"][number]>(
    `select prompt, count(*)::int as calls, sum(dollars)::float as dollars, percentile_cont(0.5) within group (order by ms) as p50 from traces where at > ${since[0]} and prompt is not null group by prompt order by prompt`,
    [...since[1]],
  );
  const recent = await query<Trace>(
    `select ${columns} from traces order by at desc limit 20`,
  );
  return {
    calls: totals.calls,
    errors: totals.errors,
    dollars: totals.dollars,
    cached: totals.cached,
    p50: Math.round(totals.p50 ?? 0),
    p95: Math.round(totals.p95 ?? 0),
    byTenant,
    byPrompt: byPrompt.map((row) => ({ ...row, p50: Math.round(row.p50) })),
    recent,
  };
}
