import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { questions, site } from "../../site/src/site";
import { query } from "./db";

/** One assistant's answer to one buyer question: whether it cited the site, and whom it cited instead. */
export type Citation = {
  at: string;
  assistant: string;
  question: string;
  cited: boolean;
  sources: string[];
};

// The assistants asked, each with its own web search. Others join when their keys do.
const assistants = [
  {
    name: "claude",
    ask: (prompt: string) =>
      generateText({
        model: anthropic("claude-sonnet-5-5"),
        prompt,
        tools: {
          web_search: anthropic.tools.webSearch_20260209({ maxUses: 3 }),
        },
      }),
  },
];

/** Asks every assistant every buyer question, and keeps what each cited in `citations`. */
export async function measureCitations(host = new URL(site.url).host) {
  const at = new Date().toISOString().slice(0, 10);
  const results: Citation[] = [];
  for (const assistant of assistants) {
    for (const { question } of questions) {
      const { sources } = await assistant.ask(question);
      const hosts = [
        ...new Set(
          sources.flatMap((s) =>
            s.sourceType === "url" ? [new URL(s.url).host] : [],
          ),
        ),
      ];
      results.push({
        at,
        assistant: assistant.name,
        question,
        cited: hosts.includes(host),
        sources: hosts,
      });
    }
  }
  for (const r of results)
    await query(
      `insert into citations (at, assistant, question, cited, sources) values ($1, $2, $3, $4, $5)`,
      [r.at, r.assistant, r.question, r.cited, r.sources],
    );
  return results;
}
