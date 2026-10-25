import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { query } from "./db";
import type { Embed } from "./embeddings";

const root = path.join(process.cwd(), "content/knowledge");
const slugFile = /^([a-z0-9-]+)\.md$/;
const FrontMatter = z.object({
  title: z.string(),
  owner: z.string(),
  updated: z.iso.date(),
});

export type Section = { heading: string; text: string };
/** A document's path is `section/slug`; a part of it is `section/slug#heading`. */
export type Document = z.infer<typeof FrontMatter> & {
  path: string;
  section: string;
  slug: string;
  body: string;
  sections: Section[];
};
export type Chunk = {
  path: string;
  document: string;
  title: string;
  heading: string;
  text: string;
};
export type Hit = {
  path: string;
  title: string;
  heading: string;
  score: number;
};

export const slugify = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Every document in the knowledge base, by section then title. */
export async function listDocuments(section?: string): Promise<Document[]> {
  "use cache";
  const sections = section
    ? [section]
    : (await readdir(root, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
  const documents = await Promise.all(
    sections.map(async (section) => {
      const files = await readdir(path.join(root, section)).catch(
        () => [] as string[],
      );
      return Promise.all(
        files
          .flatMap((f) => f.match(slugFile)?.[1] ?? [])
          .map((slug) => readDocument(section, slug)),
      );
    }),
  );
  return documents
    .flat()
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section) || a.title.localeCompare(b.title),
    );
}

/** One document by path, or one of its sections with `#heading`; undefined when there is no such thing. */
export async function getDocument(
  documentPath: string,
): Promise<Document | undefined> {
  "use cache";
  const match = documentPath.match(/^([a-z0-9-]+)\/([a-z0-9-]+)$/);
  if (!match) return undefined;
  return readDocument(match[1], match[2]).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return undefined;
      throw err;
    },
  );
}

async function readDocument(section: string, slug: string): Promise<Document> {
  const text = await readFile(path.join(root, section, `${slug}.md`), "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${section}/${slug}.md has no front matter`);
  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => line.split(/:\s+/, 2)),
  );
  const body = match[2].trim();
  return {
    ...FrontMatter.parse(fields),
    path: `${section}/${slug}`,
    section,
    slug,
    body,
    sections: split(body),
  };
}

/** A body split at its `##` headings; what comes before the first heading is the introduction. */
function split(body: string): Section[] {
  const parts = body.split(/^## /m);
  const sections = parts.slice(1).map((part) => {
    const [heading, ...rest] = part.split("\n");
    return { heading: heading.trim(), text: rest.join("\n").trim() };
  });
  return parts[0].trim()
    ? [{ heading: "Introduction", text: parts[0].trim() }, ...sections]
    : sections;
}

export const chunksOf = (document: Document): Chunk[] =>
  document.sections.map((section) => ({
    path: `${document.path}#${slugify(section.heading)}`,
    document: document.path,
    title: document.title,
    heading: section.heading,
    text: section.text,
  }));

const asVector = (embedding: number[]) => `[${embedding.join(",")}]`;

/**
 * Rebuilds the chunk index from the documents: one row per section, full-text
 * searchable, and embedded when an embedder is given.
 */
export async function indexKnowledge(embed?: Embed) {
  const chunks = (await listDocuments()).flatMap(chunksOf);
  await query(`delete from chunks`);
  for (const c of chunks) {
    await query(
      `insert into chunks (path, document, title, heading, text) values ($1, $2, $3, $4, $5)`,
      [c.path, c.document, c.title, c.heading, c.text],
    );
  }
  if (embed) {
    for (let i = 0; i < chunks.length; i += 64) {
      const batch = chunks.slice(i, i + 64);
      const embeddings = await embed(
        batch.map((c) => `${c.title}\n${c.heading}\n${c.text}`),
        "document",
      );
      for (const [j, c] of batch.entries())
        await query(
          `update chunks set embedding = $2::vector where path = $1`,
          [c.path, asVector(embeddings[j])],
        );
    }
  }
  return chunks.length;
}

const countOf = async (where: string) =>
  Number(
    (
      await query<{ count: number | string }>(
        `select count(*)::int as count from chunks ${where}`,
      )
    )[0].count,
  );

/** Builds the index on first use, embedding it when an embedder is given. */
async function indexed(embed?: Embed) {
  if ((await countOf("")) === 0) await indexKnowledge(embed);
}

/**
 * The 10 sections most relevant to a query: by meaning when embeddings exist,
 * by words otherwise. `sections` narrows the search to those parts of the base.
 */
export async function find(
  text: string,
  embed?: Embed,
  sections?: string[],
): Promise<Hit[]> {
  await indexed(embed);
  const within = sections ?? null;
  // Search by meaning when the chunks carry embeddings; by words otherwise,
  // which is also what an index built without a key falls back to.
  if (embed && (await countOf("where embedding is not null")) > 0) {
    const [vector] = await embed([text], "query");
    return query<Hit>(
      `select path, title, heading, round((1 - (embedding <=> $1::vector))::numeric, 3)::float as score
       from chunks where embedding is not null and ($2::text[] is null or split_part(path, '/', 1) = any($2))
       order by embedding <=> $1::vector limit 10`,
      [asVector(vector), within],
    );
  }
  // Any word may match; ts_rank favours the sections where most of them do.
  const words = [
    ...new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []),
  ].join(" | ");
  if (!words) return [];
  return query<Hit>(
    `select path, title, heading, round(ts_rank(tsv, q)::numeric, 3)::float as score
     from chunks, to_tsquery('english', $1) q
     where tsv @@ q and ($2::text[] is null or split_part(path, '/', 1) = any($2))
     order by score desc, path limit 10`,
    [words, within],
  );
}

/** Lines matching a pattern, across the knowledge base or under one path, as `path:line: text`. */
export async function grep(
  pattern: string,
  under = "",
  sections?: string[],
  limit = 50,
): Promise<string[]> {
  const regex = new RegExp(pattern, "i");
  const matches: string[] = [];
  for (const document of await listDocuments()) {
    if (
      !document.path.startsWith(under) ||
      (sections && !sections.includes(document.section))
    )
      continue;
    document.body.split("\n").forEach((line, index) => {
      if (regex.test(line))
        matches.push(`${document.path}:${index + 1}: ${line.trim()}`);
    });
    if (matches.length >= limit) break;
  }
  return matches.slice(0, limit);
}
