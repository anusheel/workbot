"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Answer, Query } from "@/lib/sheets";

export type Asked = { question?: string; answer?: Answer; error?: string };
type Props = { action: (state: Asked, formData: FormData) => Promise<Asked> };

const figure = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const shown = (value: unknown) =>
  value === null
    ? "—"
    : typeof value === "number"
      ? figure.format(value)
      : String(value);

/** A question about a sheet, answered with the SQL that produced the answer and the rows each query returned. */
export function SheetQuestion({ action }: Props) {
  const [state, act, pending] = useActionState(action, {});
  const { answer } = state;
  return (
    <section className="mt-10">
      <form action={act} className="flex gap-2">
        <Input
          name="question"
          aria-label="Question"
          placeholder="Which region had the most revenue in the third quarter?"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Asking…" : "Ask"}
        </Button>
      </form>
      {state.error && (
        <p className="mt-4 text-sm text-destructive">{state.error}</p>
      )}
      {answer && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{state.question}</p>
            <p className="mt-2 leading-relaxed">
              {answer.answer || "The run stopped before it had an answer."}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {answer.queries.length}{" "}
              {answer.queries.length === 1 ? "query" : "queries"} · $
              {answer.dollars.toFixed(4)}
            </p>
          </div>
          {answer.queries.map((query, i) => (
            <QueryResult key={i} query={query} n={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

function QueryResult({ query, n }: { query: Query; n: number }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
        <span>Query {n}</span>
        {"error" in query ? (
          <span className="text-destructive">Not run</span>
        ) : (
          <span>
            {query.more
              ? `First ${query.rows.length} rows`
              : `${query.rows.length} ${query.rows.length === 1 ? "row" : "rows"}`}
          </span>
        )}
      </div>
      <pre className="overflow-x-auto bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {query.sql}
      </pre>
      {"error" in query ? (
        <p className="border-t px-4 py-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : (
        <div className="max-h-80 overflow-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                {query.columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.rows.map((row, r) => (
                <TableRow key={r}>
                  {row.map((value, c) => (
                    <TableCell
                      key={c}
                      className={
                        typeof value === "number"
                          ? "text-right tabular-nums"
                          : undefined
                      }
                    >
                      {shown(value)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
