import { z } from "zod";
import { config } from "./config";
import { listPolicies } from "./policies";
import {
  type Message,
  type Model,
  type Provider,
  type Usage,
  complete,
} from "./providers";
import { readPage, searchWeb } from "./web";

export type Source = { title: string; url?: string; text: string };

export type ResearchEvents = {
  step(message: string): void;
  text(delta: string): void;
  /** Each model call as it completes, with the model that made it, so a caller can keep its own ledger. */
  spend?(model: Model, usage: Usage): void;
};

const Plan = z.object({
  policies: z
    .array(z.string())
    .max(3)
    .describe("slugs of the policies to read"),
  queries: z.array(z.string()).max(3).describe("web searches to run"),
});

const maxTokens = 4096;

/**
 * Answers a question from the company's policies and, when web search is
 * configured, the web. 4 steps, each its own model call: a small model
 * chooses sources, the sources are fetched, a large model extracts what is
 * relevant from each, and a large model writes the answer with citations.
 */
export async function research(
  question: string,
  provider: Provider,
  on: ResearchEvents,
) {
  const small =
    provider.models.find((m) => m.size === "small") ?? provider.models[0];
  const large =
    provider.models.find((m) => m.size === "large") ?? provider.models[0];
  const usage: Usage = { input: 0, output: 0 };
  const spend = (model: Model, used: Usage) => {
    usage.input += used.input;
    usage.output += used.output;
    on.spend?.(model, used);
  };
  const policies = await listPolicies();

  on.step("Choosing sources");
  const plan = await planSources(question, policies, provider, small, spend);

  const sources: Source[] = policies
    .filter((p) => plan.policies.includes(p.slug))
    .map((p) => ({ title: p.title, text: p.body }));
  for (const query of config.brave.key ? plan.queries : []) {
    on.step(`Searching the web for "${query}"`);
    const [top] = await searchWeb(query, 3);
    if (!top || sources.some((s) => s.url === top.url)) continue;
    sources.push({
      title: top.title,
      url: top.url,
      text: await readPage(top.url).catch(() => top.description),
    });
  }

  on.step(
    `Reading ${sources.length} ${sources.length === 1 ? "source" : "sources"}`,
  );
  const notes = await Promise.all(
    sources.map(async (source, index) => {
      const { text, usage } = await complete(provider, {
        model: large.id,
        maxTokens,
        system:
          "You extract facts. From the source, list every statement relevant to the question as short bullet points, keeping numbers and conditions exact. If nothing is relevant, answer with the single word: nothing.",
        messages: [
          {
            role: "user",
            content: `Question: ${question}\n\nSource [${index + 1}] ${source.title}\n\n${source.text}`,
          },
        ],
      });
      spend(large, usage);
      return `[${index + 1}] ${source.title}\n${text}`;
    }),
  );

  on.step("Writing the answer");
  const list = sources
    .map((s, i) => `[${i + 1}] ${s.title}${s.url ? ` ${s.url}` : ""}`)
    .join("\n");
  let answer = "";
  spend(
    large,
    await provider.stream(
      {
        model: large.id,
        maxTokens,
        system:
          "You answer questions for employees from notes taken on the company's sources. Use only the notes. Put the source number in brackets after each fact, like [1]. If the notes do not answer the question, say what is missing and which team to ask. Plain sentences, numerals for numbers. End with a line per source: [n] title, and the URL when there is one.",
        messages: [
          {
            role: "user",
            content: `Question: ${question}\n\nNotes:\n\n${notes.join("\n\n")}\n\nSources:\n${list}`,
          },
        ],
      },
      {
        text: (delta) => {
          answer += delta;
          on.text(delta);
        },
      },
    ),
  );
  return { answer, sources, usage };
}

async function planSources(
  question: string,
  policies: { slug: string; title: string }[],
  provider: Provider,
  model: Model,
  spend: (model: Model, usage: Usage) => void,
) {
  const catalogue = policies.map((p) => `${p.slug}: ${p.title}`).join("\n");
  const system = `You plan research for a question from an employee. Reply with JSON only, matching ${JSON.stringify(z.toJSONSchema(Plan))}. Choose up to 3 policies by slug that could answer the question, and up to 3 web searches for what the policies will not cover; an empty list is fine.`;
  const messages: Message[] = [
    {
      role: "user",
      content: `Question: ${question}\n\nPolicies:\n${catalogue}`,
    },
  ];
  for (let attempt = 0; ; attempt++) {
    const { text, usage } = await complete(provider, {
      model: model.id,
      system,
      messages,
      maxTokens: 512,
    });
    spend(model, usage);
    const parsed = Plan.safeParse(parseJson(text));
    if (parsed.success) return parsed.data;
    if (attempt === 1)
      throw new Error(`The plan was not valid JSON: ${text.slice(0, 200)}`);
    messages.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content: `That is not valid: ${z.prettifyError(parsed.error)}. Reply with the JSON only.`,
      },
    );
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return undefined;
  }
}
