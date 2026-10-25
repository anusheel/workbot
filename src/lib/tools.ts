import { z } from "zod";
import { calculate } from "./calculator";
import { config } from "./config";
import { saveNote } from "./notes";
import { readPage, searchWeb } from "./web";

/** A function the model may call: a schema for what it takes and the code that runs it. */
export type Tool = {
  name: string;
  description: string;
  input: z.ZodType;
  run(input: unknown): Promise<string>;
};

function tool<Schema extends z.ZodObject>(definition: {
  name: string;
  description: string;
  input: Schema;
  run(input: z.infer<Schema>): string | Promise<string>;
}): Tool {
  return {
    ...definition,
    run: async (input) => definition.run(input as z.infer<Schema>),
  };
}

export const calculator = tool({
  name: "calculator",
  description:
    "Evaluates an arithmetic expression: + - * / % ^ and parentheses. Call it for any calculation, however small, instead of working it out yourself.",
  input: z.object({
    expression: z.string().describe("For example (1200 * 0.2) + 35"),
  }),
  run: ({ expression }) => String(calculate(expression)),
});

export const readUrl = tool({
  name: "read_url",
  description:
    "Fetches a web page and returns its text. Call it to read a page a search returned or a URL the user gave.",
  input: z.object({ url: z.url() }),
  run: ({ url }) => readPage(url),
});

export const noteTaker = tool({
  name: "save_note",
  description:
    "Saves a note for later. Call it when the user asks you to remember, note or save something.",
  input: z.object({ text: z.string().min(1).max(2_000) }),
  run: async ({ text }) => `Saved note ${(await saveNote(text)).id}.`,
});

export const webSearch = tool({
  name: "web_search",
  description:
    "Searches the web and returns up to 5 results with title, URL and snippet. Call it for anything outside the company's own documents, or when the user asks you to look something up.",
  input: z.object({ query: z.string().min(1) }),
  run: async ({ query }) => {
    const results = await searchWeb(query);
    if (results.length === 0)
      return `No results for "${query}". Try a broader query.`;
    return results
      .map((r) => `${r.title}\n${r.url}\n${r.description}`)
      .join("\n\n");
  },
});

/** What the assistant can call. Web search needs a Brave key, so it is offered only when there is one. */
export const tools: Tool[] = [
  calculator,
  readUrl,
  noteTaker,
  ...(config.brave.key ? [webSearch] : []),
];

/** A tool's input as JSON Schema, which is what both providers take. */
export function inputSchema(tool: Tool) {
  const schema = z.toJSONSchema(tool.input);
  delete schema.$schema;
  return schema;
}
