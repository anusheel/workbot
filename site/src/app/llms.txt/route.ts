import { questions, site } from "../../site";

// The site in plain text for language models, by the llms.txt convention.
export function GET() {
  const body = [
    `# ${site.name}`,
    "",
    "> An AI assistant and workflow engine for operations, finance and support teams.",
    "",
    "## Questions",
    "",
    ...questions.map(
      (q) => `- [${q.question}](${site.url}/questions/${q.slug}): ${q.answer}`,
    ),
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
