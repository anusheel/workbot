import { type Usage, anthropic } from "../providers";
import type { Finding } from "./tools";

export const frameworkNames = ["langgraph", "claude", "openai"] as const;
export type Framework = (typeof frameworkNames)[number];

/** The same instructions on the 3 frameworks; what differs is the machinery around them. */
export const instructions = `You research a question for Fieldstone Supply's operations team. Search with web_search, read the results that look relevant with read_url, and save each fact that bears on the question with save_finding, with its source. When the findings answer the question, or nothing more can be found, call write_report once: the answer in plain sentences, each fact followed by its source in brackets, then a line per source. Before each tool call, say in one short sentence what you are about to do. Numerals for numbers; no guesses.`;

export const maxSteps = 20;

/** Anthropic's small model, whatever the chat provider: the Claude Agent SDK runs nothing else, and the comparison is on one model. */
export const defaultModel = () =>
  anthropic().models.find((m) => m.size === "small")!.id;

export type Events = {
  tool?(name: string, input: unknown): void;
  text?(text: string): void;
};
export type Options = {
  model?: string;
  on?: Events;
  /** A thread to continue, where the framework keeps one. */
  thread?: string;
};
export type Run = {
  report: string;
  findings: Finding[];
  toolCalls: number;
  usage: Usage;
  dollars: number;
  ms: number;
};
export type Researcher = (topic: string, options?: Options) => Promise<Run>;
