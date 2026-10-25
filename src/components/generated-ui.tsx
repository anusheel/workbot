"use client";

import {
  ActionProvider,
  JSONUIProvider,
  Renderer,
  type SetState,
  type Spec,
  createStateStore,
  defineRegistry,
  useBoundProp,
  useStateStore,
} from "@json-render/react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { catalog } from "@/lib/catalog";
import { RequestDraft } from "@/lib/request-model";

const badgeTone = {
  neutral: "secondary",
  good: "default",
  warning: "outline",
  bad: "destructive",
} as const;
const gaps = { small: "gap-2", medium: "gap-4", large: "gap-8" };
const palette = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];

type Point = { label: string; value: number };

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
    </div>
  );
}

function Chart({
  title,
  children,
}: {
  title: string | null;
  children: ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-3">
      {title && (
        <figcaption className="text-sm font-medium text-muted-foreground">
          {title}
        </figcaption>
      )}
      {children}
    </figure>
  );
}

function Legend({ data }: { data: Point[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {data.map((point, index) => (
        <li key={point.label} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: palette[index % palette.length] }}
          />
          {point.label}: {point.value}
        </li>
      ))}
    </ul>
  );
}

/** The one action the catalog declares: a generated form becomes a work request through the API. */
const submitRequest = async (
  params: Record<string, unknown> | undefined,
  setState: SetState,
) => {
  const parsed = RequestDraft.safeParse({
    ...params,
    body: params?.body ?? "",
    priority: params?.priority ?? "normal",
  });
  const result = parsed.success
    ? await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      }).then((response) =>
        response.ok
          ? `Request "${parsed.data.title}" created.`
          : "The request was not accepted.",
      )
    : `Check the form: ${z.prettifyError(parsed.error)}`;
  setState((state) => ({ ...state, result }));
};

/**
 * Every component the catalog promises, in the app's own style. A list bound
 * to state can arrive a moment after the element that shows it, so each list
 * renders as empty until it does.
 */
const { registry, handlers } = defineRegistry(catalog(), {
  components: {
    Page: ({ props, children }) => (
      <section className="flex flex-col gap-6">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">
            {props.title}
          </h2>
          {props.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {props.description}
            </p>
          )}
        </header>
        {children}
      </section>
    ),
    Stack: ({ props, children }) => (
      <div className={`flex flex-col ${gaps[props.gap ?? "medium"]}`}>
        {children}
      </div>
    ),
    Grid: ({ props, children }) => (
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
        }}
      >
        {children}
      </div>
    ),
    Card: ({ props, children }) => (
      <Card>
        {props.title && (
          <CardHeader>
            <CardTitle>{props.title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
      </Card>
    ),
    Heading: ({ props }) => (
      <h3 className="text-lg font-semibold tracking-tight">{props.text}</h3>
    ),
    Text: ({ props }) => (
      <p
        className={`text-sm leading-relaxed ${props.muted ? "text-muted-foreground" : ""}`}
      >
        {props.text}
      </p>
    ),
    Metric: ({ props }) => (
      <div>
        <p className="text-sm text-muted-foreground">{props.label}</p>
        <p className="mt-1 text-3xl font-semibold">{props.value}</p>
        {props.note && (
          <p className="mt-1 text-xs text-muted-foreground">{props.note}</p>
        )}
      </div>
    ),
    Badge: ({ props }) => (
      <Badge variant={badgeTone[props.tone]}>{props.text}</Badge>
    ),
    Alert: ({ props }) => (
      <Alert variant={props.tone === "bad" ? "destructive" : "default"}>
        <AlertTitle>{props.title}</AlertTitle>
        {props.text && <AlertDescription>{props.text}</AlertDescription>}
      </Alert>
    ),
    Progress: ({ props }) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-sm">
          <span>{props.label}</span>
          <span className="text-muted-foreground">{props.value}%</span>
        </div>
        <Progress value={props.value} />
      </div>
    ),
    Table: ({ props }) => (
      <Table>
        <TableHeader>
          <TableRow>
            {(props.columns ?? []).map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(props.rows ?? []).map((row, index) => (
            <TableRow key={index}>
              {(props.columns ?? []).map((column) => (
                <TableCell key={column.key}>{row[column.key]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ),
    BarChart: ({ props }) => {
      const data = props.data ?? [];
      const max = Math.max(...data.map((p) => p.value), 1);
      return (
        <Chart title={props.title}>
          <ul className="flex flex-col gap-2 text-sm">
            {data.map((point) => (
              <li
                key={point.label}
                className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3"
              >
                <span className="truncate text-muted-foreground">
                  {point.label}
                </span>
                <span
                  className="h-3 rounded-sm bg-foreground"
                  style={{ width: `${(point.value / max) * 100}%` }}
                />
                <span className="text-right tabular-nums">{point.value}</span>
              </li>
            ))}
          </ul>
        </Chart>
      );
    },
    LineChart: ({ props }) => {
      const data = props.data ?? [];
      const max = Math.max(...data.map((p) => p.value), 1);
      const step = 100 / Math.max(data.length - 1, 1);
      const points = data
        .map((p, i) => `${i * step},${40 - (p.value / max) * 36}`)
        .join(" ");
      return (
        <Chart title={props.title}>
          <svg
            viewBox="0 0 100 40"
            className="h-32 w-full"
            preserveAspectRatio="none"
            role="img"
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <Legend data={data} />
        </Chart>
      );
    },
    PieChart: ({ props }) => {
      const data = props.data ?? [];
      const total = data.reduce((sum, p) => sum + p.value, 0) || 1;
      let at = 0;
      const stops = data.map((p, i) => {
        const from = at;
        at += (p.value / total) * 100;
        return `${palette[i % palette.length]} ${from}% ${at}%`;
      });
      return (
        <Chart title={props.title}>
          <div className="flex items-center gap-6">
            <div
              className="size-28 shrink-0 rounded-full"
              style={{ background: `conic-gradient(${stops.join(", ")})` }}
              role="img"
            />
            <Legend data={data} />
          </div>
        </Chart>
      );
    },
    Timeline: ({ props }) => (
      <ol className="border-l pl-4">
        {(props.events ?? []).map((event, index) => (
          <li key={index} className="relative pb-4 last:pb-0">
            <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-foreground" />
            <p className="text-xs text-muted-foreground">{event.when}</p>
            <p className="text-sm font-medium">{event.title}</p>
            {event.detail && (
              <p className="text-sm text-muted-foreground">{event.detail}</p>
            )}
          </li>
        ))}
      </ol>
    ),
    Tabs: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(
        props.value,
        bindings?.value,
      );
      return (
        <Tabs value={value} onValueChange={setValue}>
          <TabsList>
            {(props.tabs ?? []).map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      );
    },
    Form: ({ props, children }) => (
      <form
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        {props.title && (
          <h3 className="text-sm font-medium text-muted-foreground">
            {props.title}
          </h3>
        )}
        {children}
      </form>
    ),
    Input: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(
        props.value ?? undefined,
        bindings?.value,
      );
      return (
        <Field label={props.label}>
          {(id) => (
            <Input
              id={id}
              type={props.kind ?? "text"}
              value={value ?? ""}
              placeholder={props.placeholder ?? undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>
      );
    },
    Textarea: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(
        props.value ?? undefined,
        bindings?.value,
      );
      return (
        <Field label={props.label}>
          {(id) => (
            <Textarea
              id={id}
              value={value ?? ""}
              rows={props.rows ?? 4}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>
      );
    },
    Select: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(
        props.value ?? undefined,
        bindings?.value,
      );
      return (
        <Field label={props.label}>
          {(id) => (
            <NativeSelect
              id={id}
              value={value ?? ""}
              onChange={(event) => setValue(event.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="">Choose…</NativeSelectOption>
              {(props.options ?? []).map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </Field>
      );
    },
    Checkbox: ({ props, bindings }) => {
      const [checked, setChecked] = useBoundProp<boolean>(
        props.checked ?? undefined,
        bindings?.checked,
      );
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked ?? false}
            onChange={(event) => setChecked(event.target.checked)}
          />
          {props.label}
        </label>
      );
    },
    Button: ({ props, emit }) => (
      <Button
        type="button"
        variant={props.primary === false ? "outline" : "default"}
        onClick={() => emit("press")}
        className="self-start"
      >
        {props.label}
      </Button>
    ),
  },
  actions: { submit_request: submitRequest },
});

// Action handlers need the state store, which exists only inside the provider.
function Actions({ children }: { children: ReactNode }) {
  const store = useStateStore();
  const actionHandlers = useMemo(
    () =>
      handlers(
        () => (updater) => store.update(updater(store.getSnapshot())),
        () => store.getSnapshot(),
      ),
    [store],
  );
  return <ActionProvider handlers={actionHandlers}>{children}</ActionProvider>;
}

/**
 * Renders a spec the model produced, with state for tabs and forms and the
 * catalog's action wired up. The store is ours: each time the spec changes,
 * its state is copied in, so a list that streams in after the element reading
 * it still shows up.
 */
export function GeneratedUI({
  spec,
  loading,
}: {
  spec: Spec | null;
  loading?: boolean;
}) {
  const [store] = useState(() => createStateStore(spec?.state));
  useEffect(() => {
    const state = structuredClone(spec?.state ?? {});
    store.update(
      Object.fromEntries(
        Object.entries(state).map(([key, value]) => [`/${key}`, value]),
      ),
    );
  }, [spec, store]);
  return (
    <JSONUIProvider registry={registry} store={store}>
      <Actions>
        <Renderer spec={spec} registry={registry} loading={loading} />
      </Actions>
    </JSONUIProvider>
  );
}
