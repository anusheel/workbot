import { generateText } from "ai";
import { idOf } from "@/lib/agent";
import { modelFor } from "@/lib/routing";
import { close } from "@/lib/db";
import { embedder } from "@/lib/embeddings";
import { investigate } from "@/lib/investigate";
import { find, getDocument } from "@/lib/knowledge";
import { costOf } from "@/lib/providers";

// The same 10 questions, answered 2 ways: the 5 best-matching sections stuffed
// into one prompt, and the agent exploring the knowledge base with its tools.
const questions = [
  "How much can a support agent refund without approval?",
  "When does an order placed at 3pm on Tuesday ship?",
  "What do I need from a new vendor before the first order?",
  "How many days of time off do I get, and how far ahead do I request them?",
  "Who approves a $4,000 invoice?",
  "Can a custom-cut shelf be returned?",
  "What happens if a pallet delivery appointment is missed twice?",
  "How fast is the first response to an urgent ticket, and what counts as urgent?",
  "How is a lost badge handled?",
  "What should I do if I click a suspicious link?",
];

const models = { analyst: modelFor("research"), specialist: modelFor("read") };
const embed = embedder();

async function classic(question: string) {
  const hits = (await find(question, embed)).slice(0, 5);
  const context = await Promise.all(
    hits.map(async (hit) => {
      const [path, heading] = hit.path.split("#");
      const document = await getDocument(path);
      const section = document?.sections.find(
        (s) =>
          s.heading
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") === heading,
      );
      return `[${hit.title}: ${hit.heading}]\n${section?.text ?? ""}`;
    }),
  );
  const { text, usage } = await generateText({
    model: models.analyst,
    instructions:
      "Answer the question from the passages only, naming the passage you used in brackets. If they do not answer it, say so.",
    prompt: `Question: ${question}\n\n${context.join("\n\n")}`,
  });
  return {
    answer: text,
    dollars: costOf(idOf(models.analyst), {
      input: usage.inputTokens ?? 0,
      output: usage.outputTokens ?? 0,
    }),
  };
}

console.log(
  "| Question | Classic (top 5) | Agentic | Dollars classic / agentic |",
);
console.log("| --- | --- | --- | --- |");
for (const question of questions) {
  const [a, b] = await Promise.all([
    classic(question),
    investigate(question, models),
  ]);
  const cell = (text: string) => text.replace(/\s+/g, " ").slice(0, 300);
  console.log(
    `| ${question} | ${cell(a.answer)} | ${cell(b.report)} | $${a.dollars.toFixed(4)} / $${b.dollars.toFixed(4)} |`,
  );
}
await close();
