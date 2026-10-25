import { z } from "zod";
import { embedder } from "./embeddings";
import {
  type Document,
  find,
  getDocument,
  grep,
  listDocuments,
  slugify,
} from "./knowledge";
import { tool } from "./tool";

/**
 * The knowledge base as a small filesystem the model can explore, coarse to
 * fine: find what is relevant, ls to see the shape, cat to read, grep for the
 * exact phrase. Scoped to sections: a reader sees nothing outside them.
 */
export function knowledgeTools(sections?: string[]) {
  const allowed = (document: Document) =>
    !sections || sections.includes(document.section);
  const open = async (path: string) => {
    const document = await getDocument(path);
    if (!document || !allowed(document))
      throw new Error(`There is no document at ${path}.`);
    return document;
  };

  const findTool = tool({
    name: "find",
    description:
      "Finds the 10 sections of the knowledge base most relevant to a question, with their paths and scores. Start here, then cat the paths that look right.",
    input: z.object({
      query: z.string().min(2).describe("the question or topic in plain words"),
    }),
    run: async ({ query }) => {
      const hits = await find(query, embedder(), sections);
      if (hits.length === 0)
        return "Nothing matched. Try other words, or ls to browse.";
      return hits
        .map(
          (h) => `${h.score.toFixed(3)}  ${h.path}  (${h.title}: ${h.heading})`,
        )
        .join("\n");
    },
  });

  const lsTool = tool({
    name: "ls",
    description:
      "Lists the knowledge base: no path for the sections, a section (such as faq) for its documents, a document path for its headings.",
    input: z.object({
      path: z
        .string()
        .default("")
        .describe("empty, a section, or section/document"),
    }),
    run: async ({ path }) => {
      const target = path.replace(/^\/|\/$/g, "");
      if (target.includes("/")) {
        const document = await open(target);
        return document.sections
          .map((s) => `${target}#${slugify(s.heading)}  ${s.heading}`)
          .join("\n");
      }
      const documents = (await listDocuments(target || undefined)).filter(
        allowed,
      );
      if (documents.length === 0)
        throw new Error(`There is no section named ${target}.`);
      if (target)
        return documents.map((d) => `${d.path}  ${d.title}`).join("\n");
      const counts = new Map<string, number>();
      for (const d of documents)
        counts.set(d.section, (counts.get(d.section) ?? 0) + 1);
      return [...counts]
        .map(([section, count]) => `${section}/  ${count} documents`)
        .join("\n");
    },
  });

  const catTool = tool({
    name: "cat",
    description:
      "Reads a document in full by its path, or one section with section/document#heading.",
    input: z.object({ path: z.string().min(3) }),
    run: async ({ path }) => {
      const [documentPath, heading] = path.replace(/^\//, "").split("#");
      const document = await open(documentPath);
      const head = `${document.title} (${document.owner}, updated ${document.updated})`;
      if (!heading) return `${head}\n\n${document.body}`;
      const section = document.sections.find(
        (s) => slugify(s.heading) === heading,
      );
      if (!section)
        throw new Error(
          `${documentPath} has no section ${heading}; ls it to see them.`,
        );
      return `${head}\n\n## ${section.heading}\n\n${section.text}`;
    },
  });

  const grepTool = tool({
    name: "grep",
    description:
      "Searches every line of the knowledge base for a regular expression (case-insensitive), optionally under a path such as faq/ or policies/refunds. For exact phrases, numbers and names.",
    input: z.object({
      pattern: z.string().min(1),
      path: z.string().default(""),
    }),
    run: async ({ pattern, path }) => {
      const matches = await grep(pattern, path.replace(/^\//, ""), sections);
      return matches.length
        ? matches.join("\n")
        : `No line matches ${pattern}.`;
    },
  });

  return [findTool, lsTool, catTool, grepTool];
}

/** What a customer may read: the policies and the questions customers ask. */
export const customerSections = ["faq", "policies"];
