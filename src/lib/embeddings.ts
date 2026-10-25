import { config } from "./config";

export type Embed = (
  texts: string[],
  kind: "document" | "query",
) => Promise<number[][]>;

/** Embeddings from Voyage AI; undefined without a key, in which case search falls back to words. */
export function embedder(): Embed | undefined {
  const key = config.voyage.key;
  if (!key) return undefined;
  return async (texts, kind) => {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: "voyage-3.5",
        input_type: kind,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Voyage answered ${response.status}`);
    const { data } = (await response.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  };
}
