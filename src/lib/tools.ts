import { z } from "zod";
import { type Tool } from "./tool";
import { calculate } from "./calculator";
import { customerSections, knowledgeTools } from "./knowledge-tools";
import { cached } from "./cache";
import { config } from "./config";
import { when } from "./format";
import { githubEnabled, githubTools } from "./github";
import { type Contact, findContacts } from "./unified";
import { saveNote } from "./notes";
import { tool } from "./tool";
import { settings } from "./settings";
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
    "Fetches a web page and returns its text, with when it was fetched: a page read in the last hour comes from a copy. Call it to read a page a search returned or a URL the user gave.",
  input: z.object({ url: z.url() }),
  run: async ({ url }) => {
    const { value, fetchedAt, outcome } = await cached(
      `page:${url}`,
      settings.pages.maxAgeMinutes * 60_000,
      () => readPage(url),
    );
    return `As of ${when(fetchedAt)}${outcome === "stale" ? ", a fresh copy on its way" : ""}:\n${value}`;
  },
});

const contactLine = (c: Contact) =>
  `${c.name}${c.company && c.company !== c.name ? ` (${c.company})` : ""}: ${[c.email, c.phone].filter(Boolean).join(", ") || "no email or phone"}; seen in ${c.source === "github" ? "the tickets" : "a document"}`;

export const findContact = tool({
  name: "find_contact",
  description:
    "Finds contacts WorkBot has seen, the senders of documents and the people on tickets, by words in their name, email or company, or by a phone number in any written form: up to 5, each with name, company, email, phone and where it was seen. Call it for who someone is or how to reach them.",
  input: z.object({ query: z.string().min(2).max(200) }),
  run: async ({ query }) => {
    const found = await findContacts(query);
    return found.length
      ? found.map(contactLine).join("\n")
      : `No contact matches "${query}".`;
  },
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
  findContact,
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
