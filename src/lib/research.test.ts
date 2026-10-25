import { afterEach, describe, expect, test, vi } from "vitest";
import type { Completion, Provider } from "./providers";
import { research } from "./research";

// A provider that answers from a script, and remembers what it was asked.
function scripted(replies: string[]): Provider & { asked: Completion[] } {
  const asked: Completion[] = [];
  return {
    name: "anthropic",
    asked,
    models: [
      { id: "large", size: "large" },
      { id: "small", size: "small" },
    ],
    async stream(completion, on) {
      asked.push(completion);
      on.text(replies.shift() ?? "");
      return { input: 10, output: 5 };
    },
  };
}

test("reads the chosen policies, extracts notes with a large model and answers with citations", async () => {
  const provider = scripted([
    '{"policies": ["refunds", "support-sla"], "queries": []}',
    "- Agents may refund up to $200 per order",
    "- Urgent tickets get a first response within 1 hour",
    "Agents can refund up to $200 [1]. Urgent tickets are answered within 1 hour [2].\n\n[1] Customer refunds\n[2] Support response times",
  ]);
  const steps: string[] = [];
  const spent: string[] = [];
  let streamed = "";
  const result = await research("What can an agent refund?", provider, {
    step: (m) => steps.push(m),
    text: (t) => (streamed += t),
    spend: (model) => spent.push(model.id),
  });

  expect(steps).toEqual([
    "Choosing sources",
    "Reading 2 sources",
    "Writing the answer",
  ]);
  expect(result.sources.map((s) => s.title)).toEqual([
    "Customer refunds",
    "Support response times",
  ]);
  expect(result.answer).toContain("[1] Customer refunds");
  expect(result.answer).toBe(streamed);
  expect(result.usage).toEqual({ input: 40, output: 20 });
  expect(spent).toEqual(["small", "large", "large", "large"]);

  const [plan, note1, , answer] = provider.asked;
  expect(plan.model).toBe("small");
  expect(note1.model).toBe("large");
  expect(note1.messages[0].content).toContain("Source [1] Customer refunds");
  expect(answer.messages[0].content).toContain("[1] Customer refunds");
});

test("asks again when the plan is not valid JSON, then gives up", async () => {
  const provider = scripted([
    "I would read the refunds policy.",
    '{"policies": ["refunds"], "queries": []}',
    "- nothing",
    "No answer.",
  ]);
  await research("Anything?", provider, { step: () => {}, text: () => {} });
  expect(provider.asked[1].messages.at(-1)?.content).toMatch(
    /^That is not valid/,
  );

  const stubborn = scripted(["no", "still no"]);
  await expect(
    research("Anything?", stubborn, { step: () => {}, text: () => {} }),
  ).rejects.toThrow("not valid JSON");
});

// Brave answers from a table of results by query; any other address is a page.
function web(results: Record<string, { title: string; url: string }[] | 429>) {
  vi.stubEnv("BRAVE_SEARCH_KEY", "brave_test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL) => {
      if (input.hostname !== "api.search.brave.com")
        return new Response(`<p>The page at ${input.href}</p>`);
      const found = results[input.searchParams.get("q") ?? ""];
      if (found === 429) return new Response("slow down", { status: 429 });
      return Response.json({
        web: {
          results: found?.map((r) => ({ ...r, description: "from search" })),
        },
      });
    }),
  );
}

async function researchOnTheWeb(queries: string[], notes: number) {
  vi.resetModules();
  const { research } = await import("./research");
  const provider = scripted([
    JSON.stringify({ policies: [], queries }),
    ...Array.from({ length: notes }, () => "- a fact"),
    "An answer [1].",
  ]);
  const steps: string[] = [];
  const result = await research("Anything?", provider, {
    step: (m) => steps.push(m),
    text: () => {},
  });
  return { ...result, steps };
}

describe("searching the web", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("a query whose top result is already a source adds the next result", async () => {
    const one = { title: "One", url: "https://example.com/one" };
    const two = { title: "Two", url: "https://example.com/two" };
    web({ a: [one, two], b: [one, two] });

    const { sources } = await researchOnTheWeb(["a", "b"], 2);

    expect(sources.map((s) => s.url)).toEqual([one.url, two.url]);
  });

  test("a search that fails is reported and skipped, and the others still answer", async () => {
    const one = { title: "One", url: "https://example.com/one" };
    web({ a: 429, b: [one] });

    const { answer, sources, steps } = await researchOnTheWeb(["a", "b"], 1);

    expect(steps).toContainEqual(
      expect.stringMatching(/"a".*Brave Search answered 429/),
    );
    expect(sources.map((s) => s.url)).toEqual([one.url]);
    expect(answer).toBe("An answer [1].");
  });
});
