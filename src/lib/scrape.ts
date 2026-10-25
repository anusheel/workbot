import { type LanguageModel, Output, generateText } from "ai";
import { z } from "zod";
import { fetchPage, textOf } from "./web";

export type ScrapeOptions = { pages?: number; limit?: number };

/** The link a page calls "next", when it has one. */
export function nextLink(html: string, base: string): string | undefined {
  const anchors = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const [, attributes, inner] of anchors) {
    const href = attributes.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const text = textOf(inner).trim();
    if (
      /rel\s*=\s*["']next["']/i.test(attributes) ||
      /^(next|more|older|›|»|>)(\s|$)/i.test(text)
    ) {
      return new URL(href, base).href;
    }
  }
  return undefined;
}

/**
 * Reads a public page and pulls out every item that matches the schema, following
 * "next" links for up to `pages` pages. The page is reduced to text before
 * the model sees it; the schema is the contract, and Zod checks the result.
 */
export async function scrape<Item extends z.ZodObject>(
  url: string,
  item: Item,
  model: LanguageModel,
  { pages = 1, limit = 12_000 }: ScrapeOptions = {},
): Promise<z.infer<Item>[]> {
  const items: z.infer<Item>[] = [];
  let next: string | undefined = url;
  for (let read = 0; read < pages && next; read++) {
    const page = await fetchPage(next);
    const { output } = await generateText({
      model,
      output: Output.object({ schema: z.object({ items: z.array(item) }) }),
      instructions:
        "You extract structured records from the text of a web page. Return every record on the page that fits the schema, in page order, with values exactly as written; leave out anything the page does not state. Return an empty list when the page has no such records.",
      prompt: `Page: ${page.url}\n\n${textOf(page.html).slice(0, limit)}`,
    });
    items.push(...output.items);
    next = nextLink(page.html, page.url);
  }
  return items;
}
