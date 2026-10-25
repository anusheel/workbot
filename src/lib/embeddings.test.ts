import { afterEach, expect, test, vi } from "vitest";
import { embedder } from "./embeddings";

afterEach(() => vi.unstubAllGlobals());

test("there is no embedder without a key", () => {
  expect(embedder()).toBeUndefined();
});

test("the embedder posts to Voyage and returns vectors in input order", async () => {
  vi.stubEnv("VOYAGE_API_KEY", "voy_test");
  vi.resetModules();
  const { embedder } = await import("./embeddings");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
        usage: { total_tokens: 4 },
      }),
    ),
  );
  const embed = embedder()!;
  expect(await embed(["a", "b"], "query")).toEqual([
    [1, 0],
    [0, 1],
  ]);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe("https://api.voyageai.com/v1/embeddings");
  expect(JSON.parse(String(init?.body))).toMatchObject({
    model: "voyage-3.5",
    input_type: "query",
    input: ["a", "b"],
  });
  vi.unstubAllEnvs();
});
