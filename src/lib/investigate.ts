import type { LanguageModel } from "ai";
import { z } from "zod";
import { type AgentEvents, type Limits, runAgent } from "./agent";
import { config } from "./config";
import { knowledgeTools } from "./knowledge-tools";
import { tool } from "./tool";
import { readUrl, webSearch } from "./tools";

export type Finding = { text: string; source: string };

const system = `You investigate questions for Fieldstone Supply's operations and support teams, so that whoever picks up the ticket starts with the facts. Work like this: find in the knowledge base first, cat what looks relevant before you rely on it, and grep when you need an exact number or phrase. Use external sources only for what the company's own documents do not cover, and prefer official or primary sources. Save every fact that helps answer the question with its source. When the findings answer the question, or nothing more can be found, call write_report once: the answer in plain sentences, then each finding with its source in brackets. Before each tool call, say in one short sentence what you are about to do and why. Numerals for numbers; no guesses.`;

/** Investigates a ticket's question: knowledge base first, then the web when there is a search key, and ends with a sourced report. */
export async function investigate(
  question: string,
  model: LanguageModel,
  on: AgentEvents = {},
  limits?: Limits,
) {
  const findings: Finding[] = [];
  const tools = [
    ...knowledgeTools(),
    ...(config.brave.key ? [webSearch, readUrl] : []),
    tool({
      name: "save_finding",
      description:
        "Saves one fact that answers part of the question, with its source: a policy title or a URL. Call it for each fact worth keeping.",
      input: z.object({ text: z.string().min(5), source: z.string().min(2) }),
      run: ({ text, source }) => {
        findings.push({ text, source });
        return `Saved finding ${findings.length}.`;
      },
    }),
    tool({
      name: "write_report",
      description:
        "Ends the investigation with the report for the ticket. Call it once, when the findings answer the question or nothing more can be found.",
      input: z.object({ report: z.string().min(20) }),
      run: ({ report }) => report,
    }),
  ];

  const run = await runAgent({
    model,
    system,
    task: question,
    tools,
    done: "write_report",
    limits,
    on,
  });
  return {
    ...run,
    findings,
    report: run.answer || unfinished(findings, run.stopped),
  };
}

function unfinished(findings: Finding[], stopped: string) {
  const list = findings.map((f) => `- ${f.text} [${f.source}]`).join("\n");
  return `The investigation stopped (${stopped}) before a report was written.${list ? `\n\nFindings so far:\n${list}` : ""}`;
}
