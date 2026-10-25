import { z } from "zod";
import { type Tool } from "./tool";
import { calculate } from "./calculator";
import { customerSections, knowledgeTools } from "./knowledge-tools";
import { config } from "./config";
import { githubEnabled, githubTools } from "./github";
import { saveNote } from "./notes";
import { tool } from "./tool";
import { readPage, searchWeb } from "./web";

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

const web = config.brave.key ? [webSearch] : [];

/** What the assistant can call for an employee: the whole knowledge base, notes, the web, and the tickets when a ticketing system is configured. */
export const employeeTools: Tool[] = [
  ...knowledgeTools(),
  calculator,
  readUrl,
  noteTaker,
  ...web,
  ...(githubEnabled() ? githubTools() : []),
];

/** What it can call for anyone else: the customer-facing documents, no notes. */
export const customerTools: Tool[] = [
  ...knowledgeTools(customerSections),
  calculator,
  readUrl,
  ...web,
];

export { type Tool, inputSchema, tool } from "./tool";
