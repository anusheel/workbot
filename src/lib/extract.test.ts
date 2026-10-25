import { MockLanguageModelV4 } from "ai/test";
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { pdf } from "@/test/pdf";
import { docxFrom } from "./files";
import {
  type MediaType,
  extract,
  mediaTypeOf,
  mediaTypes,
  route,
} from "./extract";

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

test("a PDF with a text layer goes as its text, a scan, an image or a forced one as the file, a Word document as its text with changes", async () => {
  const typed = pdf(
    "Invoice 4471 from Tamarack Fleet Services, total due USD 7200.00, terms net 30 days",
  );
  const file = (data: Uint8Array, mediaType: MediaType) =>
    ({ kind: "file", data, mediaType }) as const;
  const text = await route(file(typed, "application/pdf"));
  expect(text.path).toBe("text");
  expect(text.source).toMatchObject({ kind: "text" });
  expect((text.source as { text: string }).text).toContain(
    "Page 1\nInvoice 4471",
  );
  expect((await route(file(pdf(), "application/pdf"))).path).toBe("native");
  expect((await route(file(typed, "application/pdf"), "native")).path).toBe(
    "native",
  );
  expect(
    (await route(file(new Uint8Array([37]), "application/pdf"))).path,
  ).toBe("native");
  expect(
    (await route(file(new Uint8Array([0x89, 0x50]), "image/png"))).path,
  ).toBe("native");
  const contract = docxFrom([
    ["Notice: ", { deleted: "30" }, { inserted: "60" }, " days"],
  ]);
  expect(await route(file(contract, mediaTypes[".docx"]))).toEqual({
    path: "text",
    source: { kind: "text", text: "Notice: [-30-][+60+] days" },
  });
});

test("a document's type comes from its bytes, not its name or what the browser said", () => {
  expect(mediaTypeOf(pdf("x"))).toBe("application/pdf");
  expect(mediaTypeOf(docxFrom([["x"]]))).toBe(mediaTypes[".docx"]);
  expect(mediaTypeOf(new TextEncoder().encode("plain text"))).toBeUndefined();
});
