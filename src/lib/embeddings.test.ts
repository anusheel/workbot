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

async function embedWith(response: Response) {
  vi.stubEnv("VOYAGE_API_KEY", "voy_test");
  vi.resetModules();
  const { embedder } = await import("./embeddings");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
  return embedder()!;
}

test("a Voyage error keeps its detail", async () => {
  const embed = await embedWith(
    Response.json({ detail: "input too long" }, { status: 400 }),
  );
  await expect(embed(["a"], "document")).rejects.toThrow(
    "Voyage answered 400: input too long",
  );
  vi.unstubAllEnvs();
});

test("a response with fewer vectors than inputs is caught", async () => {
  const embed = await embedWith(
    Response.json({ data: [{ index: 0, embedding: [1, 0] }] }),
  );
  await expect(embed(["a", "b"], "document")).rejects.toThrow(
    /1 vectors for 2 inputs/,
  );
  vi.unstubAllEnvs();
});

test("a response without a data array is caught", async () => {
  const embed = await embedWith(Response.json({}));
  await expect(embed(["a", "b"], "document")).rejects.toThrow(
    /0 vectors for 2 inputs/,
  );
  vi.unstubAllEnvs();
});
