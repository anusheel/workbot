import { expect, test } from "vitest";
import {
  chunksOf,
  find,
  getDocument,
  grep,
  indexKnowledge,
  listDocuments,
} from "./knowledge";

test("the knowledge base has 50 or more documents in sections, each with front matter and headings", async () => {
  const documents = await listDocuments();
  expect(documents.length).toBeGreaterThanOrEqual(50);
  expect(new Set(documents.map((d) => d.section))).toEqual(
    new Set(["faq", "it", "manuals", "people", "policies"]),
  );
  for (const document of documents) {
    expect(document.title).toBeTruthy();
    expect(document.sections.length).toBeGreaterThanOrEqual(2);
  }
  expect((await listDocuments("faq")).every((d) => d.section === "faq")).toBe(
    true,
  );
});

test("a document is read by path and split into sections", async () => {
  const document = (await getDocument("faq/shipping-times"))!;
  expect(document.sections.map((s) => s.heading)).toEqual([
    "Introduction",
    "Transit times",
    "Tracking",
    "Delays",
  ]);
  expect(chunksOf(document).map((c) => c.path)).toContain(
    "faq/shipping-times#transit-times",
  );
  expect(await getDocument("faq/nope")).toBeUndefined();
  expect(await getDocument("../../package")).toBeUndefined();
});

test("grep finds lines by pattern, optionally under a path", async () => {
  const everywhere = await grep("\\$200");
  expect(everywhere.some((m) => m.startsWith("policies/refunds:"))).toBe(true);
  expect(everywhere.some((m) => m.startsWith("faq/damaged-item:"))).toBe(true);
  expect(
    (await grep("\\$200", "faq/")).every((m) => m.startsWith("faq/")),
  ).toBe(true);
  expect(await grep("unicorn")).toEqual([]);
});

test("find ranks sections by the words of a question, indexing on first use", async () => {
  const hits = await find(
    "how much can a support agent refund on a damaged order",
  );
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.length).toBeLessThanOrEqual(10);
  expect(hits.slice(0, 3).map((h) => h.path.split("#")[0])).toContain(
    "policies/refunds",
  );
  expect(hits[0].score).toBeGreaterThan(0);
  expect(await find("the and of")).toEqual([]);
});

test("find ranks by meaning when an embedder is given", async () => {
  // A fake embedder: anything about refunds or money points one way, everything else the other.
  const refundish = (text: string) => /refund|money/i.test(text);
  const embed = async (texts: string[]) =>
    texts.map((text) => [
      refundish(text) ? 1 : 0,
      refundish(text) ? 0 : 1,
      ...Array<number>(1022).fill(0),
    ]);
  expect(await indexKnowledge(embed)).toBeGreaterThan(100);
  const hits = await find("money back", embed);
  expect(hits).toHaveLength(10);
  expect(hits.every((h) => h.score === 1)).toBe(true);
  for (const hit of hits) {
    const document = (await getDocument(hit.path.split("#")[0]))!;
    const section = document.sections.find((s) => s.heading === hit.heading)!;
    expect(refundish(`${hit.title}\n${hit.heading}\n${section.text}`)).toBe(
      true,
    );
  }
});

test("an index built without embeddings still answers a find that comes with an embedder", async () => {
  await indexKnowledge();
  const embed = async (texts: string[]) =>
    texts.map(() => Array.from({ length: 1024 }, () => 0.01));
  const hits = await find("refund limit for agents", embed);
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0].path).toMatch(/refund/);
});
