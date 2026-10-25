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
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        detail?: unknown;
      } | null;
      const detail =
        typeof body?.detail === "string"
          ? body.detail.replace(/\s+/g, " ").trim().slice(0, 200)
          : "";
      throw new Error(
        `Voyage answered ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    const { data } = (await response.json()) as {
      data?: { index: number; embedding: number[] }[];
    };
    if (!Array.isArray(data) || data.length !== texts.length) {
      const got = Array.isArray(data) ? data.length : 0;
      throw new Error(
        `Voyage returned ${got} vectors for ${texts.length} inputs`,
      );
    }
    return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  };
}
