import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const dir = path.join(process.cwd(), "content/policies");
const policyFile = /^([a-z0-9-]+)\.md$/;

const FrontMatter = z.object({
  title: z.string(),
  owner: z.string(),
  updated: z.iso.date(),
});
export type Policy = z.infer<typeof FrontMatter> & {
  slug: string;
  body: string;
};

export async function listPolicies(): Promise<Policy[]> {
  "use cache";
  const slugs = (await readdir(dir)).flatMap(
    (f) => f.match(policyFile)?.[1] ?? [],
  );
  const policies = await Promise.all(slugs.map(readPolicy));
  return policies.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPolicy(slug: string): Promise<Policy | undefined> {
  "use cache";
  if (!policyFile.test(`${slug}.md`)) return undefined;
  return readPolicy(slug).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") return undefined;
    throw err;
  });
}

async function readPolicy(slug: string): Promise<Policy> {
  const text = await readFile(path.join(dir, `${slug}.md`), "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${slug}.md has no front matter`);
  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => line.split(/:\s+/, 2)),
  );
  return { slug, body: match[2].trim(), ...FrontMatter.parse(fields) };
}
