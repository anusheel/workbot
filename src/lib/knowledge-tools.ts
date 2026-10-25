import { z } from "zod";
import { getPolicy, searchPolicies } from "./policies";
import { tool } from "./tools";

/** The company's knowledge base as 2 tools: find the policies that match, then read one in full. */
export const searchKnowledgeBase = tool({
  name: "search_knowledge_base",
  description:
    "Searches the company's policies and returns the documents that match, with the lines that matched. Call it first, before anything external.",
  input: z.object({ query: z.string().min(2) }),
  run: async ({ query }) => {
    const hits = await searchPolicies(query);
    if (hits.length === 0)
      return "No policy mentions this. Try other words, or an external source.";
    return hits
      .map(
        (hit) =>
          `${hit.slug}: ${hit.title}\n${hit.snippets.map((s) => `  ${s}`).join("\n")}`,
      )
      .join("\n\n");
  },
});

export const readPolicy = tool({
  name: "read_policy",
  description: "Reads one policy in full, by the slug a search returned.",
  input: z.object({ slug: z.string() }),
  run: async ({ slug }) => {
    const policy = await getPolicy(slug);
    if (!policy) throw new Error(`There is no policy named ${slug}.`);
    return `${policy.title} (${policy.owner}, updated ${policy.updated})\n\n${policy.body}`;
  },
});
