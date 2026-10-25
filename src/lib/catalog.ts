import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";
import { priorities, teams } from "./request-model";

const text = z.string();
const tone = z.enum(["neutral", "good", "warning", "bad"]);
const point = z.object({ label: text, value: z.number() });
const cell = z.union([text, z.number()]);

/**
 * What the model may compose a page from. Every component is implemented in
 * generated-ui.tsx; nothing outside this list can appear on screen.
 */
export const catalog = defineCatalog(schema, {
  components: {
    Page: {
      props: z.object({ title: text, description: text.nullable() }),
      slots: ["default"],
      description:
        "The root of every page: a title, an optional one-line description, then the content",
    },
    Stack: {
      props: z.object({ gap: z.enum(["small", "medium", "large"]).nullable() }),
      slots: ["default"],
      description: "Children stacked vertically",
    },
    Grid: {
      props: z.object({ columns: z.number().int().min(2).max(4) }),
      slots: ["default"],
      description:
        "Children in equal columns; use it for rows of metrics or cards",
    },
    Card: {
      props: z.object({ title: text.nullable() }),
      slots: ["default"],
      description: "A bordered section with an optional title",
    },
    Heading: { props: z.object({ text }), description: "A section heading" },
    Text: {
      props: z.object({ text, muted: z.boolean().nullable() }),
      description: "A paragraph; muted for secondary notes",
    },
    Metric: {
      props: z.object({ label: text, value: cell, note: text.nullable() }),
      description: "One number that matters, with a label and an optional note",
    },
    Badge: {
      props: z.object({ text, tone }),
      description: "A short status label",
    },
    Alert: {
      props: z.object({ title: text, text: text.nullable(), tone }),
      description: "A callout for something the reader should act on or know",
    },
    Progress: {
      props: z.object({ label: text, value: z.number().min(0).max(100) }),
      description: "A labelled bar from 0 to 100",
    },
    Table: {
      props: z.object({
        columns: z.array(z.object({ key: text, label: text })),
        rows: z.array(z.record(text, cell)),
      }),
      description: "Rows of data; each row's keys match the column keys",
    },
    BarChart: {
      props: z.object({ title: text.nullable(), data: z.array(point) }),
      description:
        "Horizontal bars, one per data point; for comparing categories",
    },
    LineChart: {
      props: z.object({ title: text.nullable(), data: z.array(point) }),
      description: "A line through points in order; for change over time",
    },
    PieChart: {
      props: z.object({ title: text.nullable(), data: z.array(point) }),
      description: "Shares of a whole; at most 6 slices",
    },
    Timeline: {
      props: z.object({
        events: z.array(
          z.object({ when: text, title: text, detail: text.nullable() }),
        ),
      }),
      description:
        "Events in order, each with a time, a title and an optional detail",
    },
    Tabs: {
      props: z.object({
        tabs: z.array(z.object({ id: text, label: text })),
        value: text,
      }),
      description:
        "Tab buttons. Bind value with $bindState to a state path such as /tab, and give each tab's content a visible condition on that path",
    },
    Form: {
      props: z.object({ title: text.nullable() }),
      slots: ["default"],
      description:
        "Groups inputs; put a Button with the submit_request action last",
    },
    Input: {
      props: z.object({
        label: text,
        value: text.nullable(),
        placeholder: text.nullable(),
        kind: z.enum(["text", "email", "number", "date"]).nullable(),
      }),
      description:
        "A one-line field; bind value with $bindState to a path under /form",
    },
    Textarea: {
      props: z.object({
        label: text,
        value: text.nullable(),
        rows: z.number().int().min(2).max(10).nullable(),
      }),
      description:
        "A multi-line field; bind value with $bindState to a path under /form",
    },
    Select: {
      props: z.object({
        label: text,
        value: text.nullable(),
        options: z.array(z.object({ value: text, label: text })),
      }),
      description:
        "A choice from a list; bind value with $bindState to a path under /form",
    },
    Checkbox: {
      props: z.object({ label: text, checked: z.boolean().nullable() }),
      description: "A yes/no field; bind checked with $bindState",
    },
    Button: {
      props: z.object({ label: text, primary: z.boolean().nullable() }),
      events: ["press"],
      description: "A button; its press event runs an action",
    },
  },
  actions: {
    submit_request: {
      description:
        "Creates a work request from the form. Params come from state: title (/form/title), body (/form/body), team (/form/team: operations, finance or support) and priority (/form/priority: low, normal or high)",
      params: z.object({
        title: text,
        body: text.nullable(),
        team: z.enum(teams),
        priority: z.enum(priorities).nullable(),
      }),
    },
  },
});

export type Catalog = typeof catalog;
