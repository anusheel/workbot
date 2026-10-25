import type { LanguageModel } from "ai";
import { z } from "zod";
import { type Limits, type Stopped, idOf, runAgent } from "./agent";
import { type Browser, browse, chromeBrowser } from "./browser-agent";
import { config } from "./config";
import { customer, teamList } from "./customer";
import { knowledgeTools } from "./knowledge-tools";
import { costOf } from "./providers";
import { tool } from "./tool";
import { readUrl, webSearch } from "./tools";
import { isPublic, readPage } from "./web";

export type Finding = { text: string; source: string };

/** One line of a run's log: what the agent thought, called or finished, and when. */
export type Entry = { at: Date } & (
  | { kind: "thought"; text: string }
  | {
      kind: "tool";
      name: string;
      input: unknown;
      result: string;
      failed: boolean;
    }
  | { kind: "done"; stopped: Stopped; steps: number; dollars: number }
);

export type Investigation = {
  report: string;
  findings: Finding[];
  log: Entry[];
  dollars: number;
  stopped: Stopped;
};

type Options = {
  on?: { log?(entry: Entry): void };
  limits?: Limits;
  /** Opens a browser for a page that needs working: the machine's Chrome, unless a test says otherwise. */
  browser?: (start: string) => Promise<Browser>;
};

const instructions = `You are the research analyst for ${customer.name}'s ${teamList(customer)} teams: a ticket's question comes in, a report with sources goes back. Search the knowledge base first: find, then cat what looks relevant before you rely on it, and grep for an exact number or phrase. Read the web only for what the company's own documents do not cover, or when the question names a site: read_url for a page's text, browse_site for a page that needs clicks or whose text came back empty, web_search when you have it. Save every fact that bears on the question with save_finding, with the document's title or the page's address as the source. When the findings answer the question, or nothing more can be found, call write_report once: the answer in plain sentences, each fact followed by its source in brackets, then a line per source. Before each tool call, say in one short sentence what you are about to do and why. Numerals for numbers; no guesses.`;

/**
 * Investigates a ticket's question: one agent with the knowledge base and
 * the web as its tools, a list of findings, and a sourced report at the end.
 * Every thought, call and result is logged with its time, and the run is
 * priced, the browser's calls included. One agent rather than an analyst
 * with specialists: the comparison in the architecture document showed the
 * delegation read no better and cost more.
 */
export async function investigate(
  question: string,
  model: LanguageModel,
  { on = {}, limits, browser = chromeBrowser }: Options = {},
): Promise<Investigation> {
  const findings: Finding[] = [];
  const log: Entry[] = [];
  // The browser agent is charged call by call, so an attempt that fails midway is on the bill too.
  let browsing = 0;
  const record = (entry: Entry) => {
    log.push(entry);
    on.log?.(entry);
  };

  const saveFinding = tool({
    name: "save_finding",
    description:
      "Saves one fact that answers part of the question, with its source: a document's title or a page's address. Call it for each fact worth keeping.",
    input: z.object({ text: z.string().min(5), source: z.string().min(2) }),
    run: ({ text, source }) => {
      findings.push({ text, source });
      return `Saved finding ${findings.length}.`;
    },
  });

  const browseSite = tool({
    name: "browse_site",
    description:
      "A browser agent works a page by looking at it, clicking, typing and scrolling to carry out a task, and reports what it saw. For a page that needs interaction, or whose text came back empty.",
    input: z.object({
      url: z.url(),
      task: z
        .string()
        .min(5)
        .describe("what to do on the page and what to report"),
    }),
    run: async ({ url, task }) => {
      // The browser's bounds always include the site it starts on, so the start itself has to be public.
      if (!isPublic(new URL(url)))
        throw new Error(`${url} is not a public web address`);
      const once = async () => {
        const page = await browser(url);
        try {
          return await browse(task, url, model, page, {
            maxSteps: 8,
            on: { spend: (used) => (browsing += costOf(idOf(model), used)) },
          });
        } finally {
          await page.close();
        }
      };
      // One retry covers a browser that did not start or a page that timed out; after that the page's text stands in.
      const result = await once()
        .catch(once)
        .catch((err: unknown) => ({
          outcome: "failed",
          result: err instanceof Error ? err.message : String(err),
        }));
      if (result.outcome === "done") return result.result;
      return `The browser could not finish (${result.outcome}: ${result.result}). The page's text instead:\n\n${await readPage(url, 6_000)}`;
    },
  });

  const writeReport = tool({
    name: "write_report",
    description:
      "Ends the investigation with the report for the ticket. Call it once, when the findings answer the question or nothing more can be found.",
    input: z.object({ report: z.string().min(20) }),
    run: ({ report }) => report,
  });

  const run = await runAgent({
    model,
    system: instructions,
    task: question,
    tools: [
      ...knowledgeTools(),
      readUrl,
      browseSite,
      ...(config.brave.key ? [webSearch] : []),
      saveFinding,
      writeReport,
    ],
    done: "write_report",
    limits: { seconds: 300, ...limits },
    on: {
      thought: (text) => record({ at: new Date(), kind: "thought", text }),
      tool: (call) => record({ at: new Date(), kind: "tool", ...call }),
    },
  });
  const dollars = run.dollars + browsing;
  record({
    at: new Date(),
    kind: "done",
    stopped: run.stopped,
    steps: run.steps,
    dollars,
  });
  return {
    report: run.answer || unfinished(findings, run.stopped),
    findings,
    log,
    dollars,
    stopped: run.stopped,
  };
}

function unfinished(findings: Finding[], stopped: Stopped) {
  const list = findings.map((f) => `- ${f.text} [${f.source}]`).join("\n");
  return `The investigation stopped (${stopped}) before a report was written.${list ? `\n\nFindings so far:\n${list}` : ""}`;
}
