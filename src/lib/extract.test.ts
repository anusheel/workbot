import { MockLanguageModelV4 } from "ai/test";
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { extract } from "./extract";

/** A model that answers from a script and keeps every prompt it was sent. */
function scripted(replies: string[]) {
  const prompts: { role: string; content: unknown }[][] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        content: [{ type: "text", text: replies.shift() ?? "" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

const Receipt = z.object({
  vendor: z.string(),
  total: z.number(),
  paid: z.boolean().nullable(),
});
const text = (prompt: { content: unknown }[]) =>
  (prompt.at(-1)?.content as { type: string; text?: string }[])
    .map((p) => p.text ?? `<${p.type}>`)
    .join(" ");

afterEach(() => vi.unstubAllGlobals());

test("an output that does not fit the schema goes back to the model with the reason, up to 3 times", async () => {
  const { model, prompts } = scripted([
    JSON.stringify({
      data: { vendor: "Acme", total: "forty" },
      confidence: [],
    }),
    JSON.stringify({
      data: { vendor: "Acme", total: 40, paid: null },
      confidence: [
        { field: "vendor", score: 1 },
        { field: "total", score: 0.9 },
        { field: "paid", score: 0.2 },
      ],
    }),
  ]);
  const result = await extract(
    { kind: "text", text: "Acme Supplies. Total: forty dollars." },
    Receipt,
    model,
  );
  expect(result).toEqual({
    data: { vendor: "Acme", total: 40, paid: null },
    confidence: { vendor: 1, total: 0.9, paid: 0.2 },
    review: ["paid"],
    attempts: 2,
  });
  expect(prompts).toHaveLength(2);
  expect(text(prompts[1])).toMatch(/^That did not match the schema: /);
  expect(text(prompts[1])).toMatch(/Return the corrected record only\.$/);
  expect(prompts[1].at(-2)).toMatchObject({ role: "assistant" });
});

test("3 bad outputs in a row are an error, with the last reason", async () => {
  const bad = JSON.stringify({ data: { vendor: 1 }, confidence: [] });
  const { model, prompts } = scripted([bad, bad, bad]);
  await expect(
    extract({ kind: "text", text: "?" }, Receipt, model),
  ).rejects.toThrow();
  expect(prompts).toHaveLength(3);
});

test("a page's text and a file's bytes reach the model in the right parts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<h1>Acme</h1><p>Total $12</p>")),
  );
  const good = JSON.stringify({
    data: { vendor: "Acme", total: 12, paid: true },
    confidence: [{ field: "vendor", score: 1 }],
  });
  const { model, prompts } = scripted([good, good]);
  await extract(
    { kind: "url", url: "https://acme.example/receipt" },
    Receipt,
    model,
  );
  expect(text(prompts[0])).toBe(
    "Page: https://acme.example/receipt\n\nAcme\nTotal $12",
  );
  await extract(
    {
      kind: "file",
      data: new Uint8Array([37, 80, 68, 70]),
      mediaType: "application/pdf",
    },
    Receipt,
    model,
  );
  const parts = prompts[1].at(-1)?.content as {
    type: string;
    mediaType?: string;
  }[];
  expect(parts.map((p) => p.type)).toEqual(["text", "file"]);
  expect(parts[1].mediaType).toBe("application/pdf");
});
