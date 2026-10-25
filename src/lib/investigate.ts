import type { LanguageModel } from "ai";
import { z } from "zod";
import {
  type AgentEvents,
  type Limits,
  type Stopped,
  idOf,
  runAgent,
} from "./agent";
import { type Browser, browse, chromeBrowser } from "./browser-agent";
import { config } from "./config";
import { knowledgeTools } from "./knowledge-tools";
import { costOf } from "./providers";
import { type Tool, tool } from "./tool";
import { readUrl, webSearch } from "./tools";
import { isPublic, readPage } from "./web";

export type Finding = { text: string; source: string };
export type Agent = "analyst" | "knowledge" | "web";

/** One line of a run's log: what an agent thought, called or finished, and when. */
export type Entry = { at: Date; agent: Agent } & (
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
  /** Dollars by agent; `dollars` is the total. */
  cost: Record<Agent, number>;
  dollars: number;
  stopped: Stopped;
};

export type Models = { analyst: LanguageModel; specialist: LanguageModel };

type Options = {
  on?: { log?(entry: Entry): void };
  limits?: Limits;
  /** Opens a browser for the web specialist: the machine's Chrome, unless a test says otherwise. */
  browser?: (start: string) => Promise<Browser>;
};

const analyst = `You are the research analyst for Fieldstone Supply's operations and support teams: a ticket's question comes in, a report with sources goes back. Ask the knowledge base first, through ask_knowledge_base. Ask the web, through ask_web, only for what the company's own documents do not cover, or when the question names a site. Each specialist saves findings as it works and reports back; ask again when something is missing. When the findings answer the question, or nothing more can be found, call write_report once: the answer in plain sentences, each fact followed by its source in brackets, then a line per source. Before each tool call, say in one short sentence what you are about to do and why. Numerals for numbers; no guesses.`;

const librarian = `You search Fieldstone Supply's knowledge base for an analyst. find first, cat what looks relevant before you rely on it, and grep for an exact number or phrase. Save every fact that bears on the question with save_finding, with the document's title as the source. Then answer in plain sentences: what you found, and what the documents do not cover. Numerals for numbers; no guesses.`;

const reader = `You read the web for an analyst. read_url gives a page's text; browse_site works a page that needs clicks or typing, or whose text came back empty; web_search, when you have it, finds pages for what you have no address for, or another page when one could not be read. Save every fact that bears on the question with save_finding, with the page's address as the source. Then answer in plain sentences: what you found, and what you could not reach. Numerals for numbers; no guesses.`;

const specialistLimits: Limits = { steps: 8, dollars: 0.2, seconds: 90 };

/**
 * Investigates a ticket's question. An analyst delegates to a knowledge-base
 * specialist and a web specialist; all 3 write to one list of findings, and
 * the analyst ends with a sourced report. Every thought, call and result is
 * logged with its agent and time, and each agent's spend is priced.
 */
export async function investigate(
  question: string,
  models: Models,
  { on = {}, limits, browser = chromeBrowser }: Options = {},
): Promise<Investigation> {
  const findings: Finding[] = [];
  const log: Entry[] = [];
  const cost: Record<Agent, number> = { analyst: 0, knowledge: 0, web: 0 };
  const record = (entry: Entry) => {
    log.push(entry);
    on.log?.(entry);
  };
  const events = (agent: Agent): AgentEvents => ({
    thought: (text) => record({ at: new Date(), agent, kind: "thought", text }),
    tool: (call) => record({ at: new Date(), agent, kind: "tool", ...call }),
  });

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

  // A specialist is a tool to the analyst: its own loop on the small model,
  // handed the findings so far, answering in text and adding to the list.
  const specialist = (
    agent: Agent,
    name: string,
    description: string,
    system: string,
    tools: Tool[],
  ) =>
    tool({
      name,
      description,
      input: z.object({
        question: z
          .string()
          .min(5)
          .describe(
            "what to find out, with any name, number or address it needs",
          ),
      }),
      run: async ({ question }) => {
        const known = findings
          .map((f) => `- ${f.text} [${f.source}]`)
          .join("\n");
        const run = await runAgent({
          model: models.specialist,
          system,
          task: known ? `${question}\n\nKnown so far:\n${known}` : question,
          tools: [...tools, saveFinding],
          limits: specialistLimits,
          on: events(agent),
        });
        cost[agent] += run.dollars;
        record({
          at: new Date(),
          agent,
          kind: "done",
          stopped: run.stopped,
          steps: run.steps,
          dollars: run.dollars,
        });
        return (
          run.answer ||
          `The specialist stopped (${run.stopped}) before answering; its findings, if any, are saved.`
        );
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
          return await browse(task, url, models.specialist, page, {
            maxSteps: 8,
            // Charged call by call, so an attempt that fails midway is on the bill too.
            on: {
              spend: (used) =>
                (cost.web += costOf(idOf(models.specialist), used)),
            },
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

  const tools = [
    specialist(
      "knowledge",
      "ask_knowledge_base",
      "Has a specialist search the company's knowledge base (policies, manuals, IT, FAQ, HR) and save findings with their document as the source. Ask it first.",
      librarian,
      knowledgeTools(),
    ),
    specialist(
      "web",
      "ask_web",
      "Has a specialist read the web: a page's text, a site that needs clicks, or a search when one is configured, saving findings with their address as the source. Ask it for what the company's documents do not cover.",
      reader,
      [readUrl, browseSite, ...(config.brave.key ? [webSearch] : [])],
    ),
    tool({
      name: "write_report",
      description:
        "Ends the investigation with the report for the ticket. Call it once, when the findings answer the question or nothing more can be found.",
      input: z.object({ report: z.string().min(20) }),
      run: ({ report }) => report,
    }),
  ];

  const run = await runAgent({
    model: models.analyst,
    system: analyst,
    task: question,
    tools,
    done: "write_report",
    limits: { seconds: 300, ...limits },
    on: events("analyst"),
  });
  cost.analyst = run.dollars;
  record({
    at: new Date(),
    agent: "analyst",
    kind: "done",
    stopped: run.stopped,
    steps: run.steps,
    dollars: run.dollars,
  });
  return {
    report: run.answer || unfinished(findings, run.stopped),
    findings,
    log,
    cost,
    dollars: cost.analyst + cost.knowledge + cost.web,
    stopped: run.stopped,
  };
}

function unfinished(findings: Finding[], stopped: Stopped) {
  const list = findings.map((f) => `- ${f.text} [${f.source}]`).join("\n");
  return `The investigation stopped (${stopped}) before a report was written.${list ? `\n\nFindings so far:\n${list}` : ""}`;
}
