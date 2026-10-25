import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  type LanguageModel,
  type ModelMessage,
  type UserContent,
  NoObjectGeneratedError,
  Output,
  generateText,
} from "ai";
import { z } from "zod";
import { fetchPage, textOf } from "./web";

export const mediaTypes = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
} as const;
/** A file goes to the model whole, so an upload is checked against this before any call. */
export const maxFileBytes = 10 * 1024 * 1024;
export const fileSizeError = (size: number) =>
  size === 0 || size > maxFileBytes
    ? `document must not be empty or larger than ${maxFileBytes / 1024 / 1024} MB`
    : null;
export type MediaType = (typeof mediaTypes)[keyof typeof mediaTypes];

/** Where a document comes from: its text, a page, or the file itself for a PDF or an image. */
export type Source =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "file"; data: Uint8Array; mediaType: MediaType };

export type Extraction<T> = {
  data: T;
  /** How sure the model was of each top-level field, 0 to 1. */
  confidence: Record<string, number>;
  /** The fields under the threshold: for a person to check. */
  review: string[];
  attempts: number;
};

const limit = 20_000;

/** A file on disk as a source: a PDF or an image by its extension, anything else as text. */
export async function fromPath(path: string): Promise<Source> {
  const extension = extname(path).toLowerCase();
  if (extension in mediaTypes)
    return {
      kind: "file",
      data: new Uint8Array(await readFile(path)),
      mediaType: mediaTypes[extension as keyof typeof mediaTypes],
    };
  const text = await readFile(path, "utf8");
  return { kind: "text", text: extension === ".html" ? textOf(text) : text };
}

/** The document as the parts of a message: its text, or the file itself for a PDF or an image. */
export async function content(source: Source): Promise<UserContent> {
  switch (source.kind) {
    case "text":
      return [{ type: "text", text: source.text.slice(0, limit) }];
    case "url": {
      const page = await fetchPage(source.url);
      return [
        {
          type: "text",
          text: `Page: ${page.url}\n\n${textOf(page.html).slice(0, limit)}`,
        },
      ];
    }
    case "file":
      return [
        { type: "text", text: "The document:" },
        { type: "file", data: source.data, mediaType: source.mediaType },
      ];
  }
}

type Scored<S extends z.ZodObject> = {
  data: z.infer<S>;
  confidence: { field: string; score: number }[];
};

const scored = <S extends z.ZodObject>(schema: S) =>
  z.object({
    data: schema,
    confidence: z
      .array(z.object({ field: z.string(), score: z.number().min(0).max(1) }))
      .describe(
        "one entry per top-level field of data: how sure you are of its value, 0 to 1, and 1 only when the document states it plainly",
      ),
  });

const instructions =
  "You extract a structured record from a document. Fill every field of the schema from the document alone: null when the document does not state it, never a guess. Numbers as numbers, dates as YYYY-MM-DD when the document gives a date, text as written.";

const reason = (error: NoObjectGeneratedError) =>
  error.cause instanceof Error
    ? error.cause.message
    : "the output was not valid";

/**
 * Extracts the record a schema describes from a document. The model's
 * output is validated against the schema; when it does not fit, the model
 * sees its own output and what was wrong with it, and tries again, up to
 * `attempts` times. Each top-level field comes back with a confidence, and
 * the ones under the threshold are listed for review.
 */
export async function extract<S extends z.ZodObject>(
  source: Source,
  schema: S,
  model: LanguageModel,
  { attempts = 3, threshold = 0.7 } = {},
): Promise<Extraction<z.infer<S>>> {
  const messages: ModelMessage[] = [
    { role: "user", content: await content(source) },
  ];
  for (let attempt = 1; ; attempt++) {
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: scored(schema) }),
        instructions,
        messages,
      });
      // The schema is generic, which the SDK's inferred output type cannot carry.
      const { data, confidence: scores } = output as Scored<S>;
      const confidence = Object.fromEntries(
        scores.map(({ field, score }) => [field, score]),
      );
      return {
        data,
        confidence,
        review: Object.keys(schema.shape).filter(
          (field) => (confidence[field] ?? 0) < threshold,
        ),
        attempts: attempt,
      };
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error) || attempt === attempts)
        throw error;
      messages.push(
        { role: "assistant", content: error.text ?? "" },
        {
          role: "user",
          content: `That did not match the schema: ${reason(error)}. Return the corrected record only.`,
        },
      );
    }
  }
}
