import { z } from "zod";
import { config } from "../config";
import { embedder } from "../embeddings";
import { find, getDocument } from "../knowledge";
import { type Tool, tool } from "../tool";
import { readPage, searchWeb } from "../web";

export type Finding = { text: string; source: string };
/** What a run collects through its tools: the findings as they are saved, the report once it is written. */
export type Notebook = { findings: Finding[]; report?: string };

const scheme = "knowledge://";

/**
 * The 4 research tools, one set for the 3 frameworks. Search is the web when
 * a search key is configured and the company's knowledge base otherwise, and
 * read_url reads either kind of address; findings and the report go to the
 * run's notebook, so a framework's own state and the tools cannot disagree.
 */
export function researchTools(notebook: Notebook): Tool[] {
  return [
    tool({
      name: "web_search",
      description:
        "Searches for pages on a topic and gives up to 5 results, each with an address for read_url: the web when a search key is configured, the company's knowledge base otherwise.",
      input: z.object({
        query: z
          .string()
          .min(2)
          .describe("the topic or question in plain words"),
      }),
      run: ({ query }) => search(query),
    }),
    tool({
      name: "read_url",
      description:
        "Reads a page's text by its address: a web page, or a knowledge:// address from web_search.",
      input: z.object({
        url: z.string().min(8).describe("the address to read"),
      }),
      run: ({ url }) => read(url),
    }),
    tool({
      name: "save_finding",
      description:
        "Saves one fact that answers part of the question, with its source: a page's address or a document's title. Call it for each fact worth keeping.",
      input: z.object({ text: z.string().min(5), source: z.string().min(2) }),
      run: ({ text, source }) => {
        notebook.findings.push({ text, source });
        return `Saved finding ${notebook.findings.length}.`;
      },
    }),
    tool({
      name: "write_report",
      description:
        "Ends the research with the report: the answer in plain sentences, each fact followed by its source in brackets, then a line per source. Call it once, when the findings answer the question or nothing more can be found.",
      input: z.object({ report: z.string().min(20) }),
      run: ({ report }) => {
        notebook.report = report;
        return "The report is written.";
      },
    }),
  ];
}

async function search(query: string) {
  const results = config.brave.key
    ? (await searchWeb(query, 5)).map(
        (r) => `${r.title}\n${r.url}\n${r.description}`,
      )
    : (await find(query, embedder()))
        .slice(0, 5)
        .map(
          (h) =>
            `${h.title}${h.heading ? `, ${h.heading}` : ""}\n${scheme}${h.path}`,
        );
  return results.join("\n\n") || "Nothing found. Try other words.";
}

async function read(url: string) {
  if (!url.startsWith(scheme)) return readPage(url);
  const document = await getDocument(url.slice(scheme.length));
  if (!document) throw new Error(`There is no document at ${url}.`);
  return `# ${document.title}\n\n${document.body}`;
}
