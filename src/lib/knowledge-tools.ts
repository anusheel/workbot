import { runInNewContext } from "node:vm";
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
import { customer } from "./customer";

/**
 * The knowledge base as a small filesystem the model can explore, coarse to
 * fine: find what is relevant, ls to see the shape, cat to read, grep for the
 * exact phrase. Scoped to sections: a reader sees nothing outside them.
 */
export function knowledgeTools(sections?: string[]) {
  // Scoped to the customer-facing sections, anyone may read; the whole base is for employees.
  const access = sections ? "public" : "viewer";
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
    access,
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
    access,
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
    access,
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
    access,
    description:
      "Searches every line of the knowledge base for a regular expression (case-insensitive), optionally under a path such as faq/ or policies/refunds. For exact phrases, numbers and names.",
    input: z.object({
      pattern: z.string().min(1),
      path: z.string().default(""),
    }),
    run: async ({ pattern, path }) => {
      const under = path.replace(/^\//, "");
      const safe = safePattern(pattern);
      await assertQuick(
        safe.source,
        (await listDocuments())
          .filter(
            (document) => document.path.startsWith(under) && allowed(document),
          )
          .map((document) => document.body)
          .join("\n"),
      );
      const matches = await grep(safe.source, under, sections);
      if (matches.length) return matches.join("\n");
      return safe.literal
        ? `No line matches ${pattern}, which is not a valid regular expression and was searched as plain text.`
        : `No line matches ${pattern}.`;
    },
  });

  return [findTool, lsTool, catTool, grepTool];
}

const maxPatternLength = 100;
const matchBudgetMs = 250;

/**
 * The web chat hands the model's pattern straight to the regex engine, and a
 * repeat inside a repeated group backtracks exponentially, so the thread that
 * serves every visitor would stall on one line. Such patterns are refused with
 * the reason, since the model can rewrite them; a pattern that does not compile
 * is searched as the text it was probably meant to be. The shape check is only
 * the early, explained refusal: `assertQuick` is what bounds the rest.
 */
function safePattern(pattern: string) {
  if (pattern.length > maxPatternLength)
    throw new Error(
      `The pattern is ${pattern.length} characters; the limit is ${maxPatternLength}. Search for a shorter phrase.`,
    );
  try {
    new RegExp(pattern, "i");
  } catch {
    return {
      source: pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      literal: true,
    };
  }
  if (repeatsARepeat(pattern))
    throw new Error(
      "The pattern repeats a group that already repeats, such as (a+)*, which can take too long to match. Search for a plain phrase, or repeat only single characters.",
    );
  return { source: pattern, literal: false };
}

/**
 * No reading of a pattern tells every slow one from a fast one ((.|.)*x,
 * .*.*.*.*Z and backreferences all stall without a nested repeat), so the
 * pattern is tried on every line `grep` could reach under a time limit, which
 * stops the thread wherever the engine backtracks. `grep` runs the same regex
 * on the same lines afterwards, so what passes here finishes there.
 */
async function assertQuick(source: string, text: string) {
  try {
    runInNewContext(
      'const regex = new RegExp(source, "i"); for (const line of text.split("\\n")) regex.test(line);',
      { source, text },
      { timeout: matchBudgetMs },
    );
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "ERR_SCRIPT_EXECUTION_TIMEOUT"
    )
      throw error;
    throw new Error(
      `The pattern took longer than ${matchBudgetMs} ms to match and was stopped; wildcards like .* repeated, or alternatives that match the same text, cause that. Search for a plain phrase instead.`,
    );
  }
}

/** Whether a quantifier follows a group that contains a quantifier; the pattern must be valid. */
function repeatsARepeat(pattern: string) {
  const quantifier = /^(?:[*+?]|\{\d+(?:,\d*)?\})/;
  const groups: boolean[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\") i++;
    else if (char === "[") {
      while (i < pattern.length - 1 && pattern[++i] !== "]")
        if (pattern[i] === "\\") i++;
    } else if (char === "(") {
      groups.push(false);
      if (pattern[i + 1] === "?") i++;
    } else if (char === ")") {
      const hasRepeat = groups.pop() ?? false;
      const repeats = quantifier.test(pattern.slice(i + 1));
      if (hasRepeat && repeats) return true;
      if ((hasRepeat || repeats) && groups.length)
        groups[groups.length - 1] = true;
    } else if (groups.length && quantifier.test(pattern.slice(i))) {
      groups[groups.length - 1] = true;
    }
  }
  return false;
}

/** What a customer may read: the policies and the questions customers ask. */
export const customerSections = customer.customerSections;
