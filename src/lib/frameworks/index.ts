import { claude } from "./claude";
import { langgraph } from "./langgraph";
import { openai } from "./openai";
import { type Framework, type Researcher, frameworkNames } from "./researcher";

export { frameworkNames };
export type { Framework, Researcher, Run } from "./researcher";
export { refused, remit } from "./openai";

/** The same agent 3 times: one call, one topic in, a report and the run's numbers out. */
export const frameworks: Record<Framework, Researcher> = {
  langgraph,
  claude,
  openai,
};
