import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { extractText } from "unpdf";

/** What a file is, by its first bytes, and for the zipped Office formats by the part that defines each: never by the name or the type a browser declared. */
export type Format = "pdf" | "docx" | "xlsx" | "png" | "jpeg" | "webp";

export function formatOf(bytes: Uint8Array): Format | undefined {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (ascii(1, 4) === "PNG") return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 2) !== "PK") return undefined;
  const parts: string[] = [];
  try {
    unzipSync(bytes, { filter: (file) => (parts.push(file.name), false) });
  } catch {
    // It starts like a zip and is not one: no format WorkBot reads.
    return undefined;
  }
  if (parts.includes("word/document.xml")) return "docx";
  if (parts.includes("xl/workbook.xml")) return "xlsx";
  return undefined;
}

/** A PDF's text layer, page by page; a scan has little or none. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  // PDF.js takes over the buffer it is given, so it gets a copy and the caller keeps the file.
  const { text } = await extractText(new Uint8Array(bytes));
  return text;
}

/** A scan, for the model to read as images: its pages average under 50 letters and digits of text, where a typed page has hundreds. */
export const scanned = (pages: string[]) =>
  pages.reduce(
    (count, page) => count + (page.match(/[\p{L}\p{N}]/gu)?.length ?? 0),
    0,
  ) /
    Math.max(pages.length, 1) <
  50;

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};
// The five named entities, and characters written by number, &#8217; or &#x2019;.
const decode = (xml: string) =>
  xml.replace(
    /&(?:(amp|lt|gt|quot|apos)|#(\d+)|#x([\da-f]+));/gi,
    (_, name, dec, hex) =>
      name
        ? entities[name]
        : String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)),
  );

// An insertion or a deletion opening or closing (not the self-closing marks a deleted paragraph leaves), a run of text, a tab, a table cell or a paragraph ending.
const token =
  /<w:(ins|del)\b[^>]*(?<!\/)>|<\/w:(ins|del)>|<w:(?:t|delText)\b[^>]*>([^<]*)<\/w:(?:t|delText)>|<w:tab\/>|<\/w:tc>|<\/w:p>/g;

/**
 * A Word document's text, paragraph by paragraph, with its tracked changes
 * left visible: an insertion as [+text+], a deletion as [-text-]. Read from
 * the document's XML directly, since a converter that renders the document
 * shows only one side of each change.
 */
export function docxText(bytes: Uint8Array): string {
  const xml = unzipSync(bytes, {
    filter: (file) => file.name === "word/document.xml",
  })["word/document.xml"];
  if (!xml) throw new Error("A Word document without word/document.xml");
  let text = "";
  for (const [whole, opened, closed, run] of strFromU8(xml).matchAll(token))
    text += opened
      ? opened === "ins"
        ? "[+"
        : "[-"
      : closed
        ? closed === "ins"
          ? "+]"
          : "-]"
        : run !== undefined
          ? decode(run)
          : whole === "<w:tab/>"
            ? "\t"
            : whole === "</w:tc>"
              ? " | "
              : "\n";
  return text
    .replace(/\+\]\[\+|-\]\[-|\[\+\+\]|\[--\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A run of a paragraph: plain text, or a change tracked as an insertion or a deletion. */
export type Run = string | { inserted: string } | { deleted: string };

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A Word document from paragraphs of runs, tracked changes included: the output side of a template, and the fixtures the reader is tested on. */
export function docxFrom(paragraphs: Run[][], author = "WorkBot"): Uint8Array {
  let id = 0;
  const mark = () =>
    `w:id="${++id}" w:author="${escape(author)}" w:date="2026-10-01T00:00:00Z"`;
  const run = (r: Run) =>
    typeof r === "string"
      ? `<w:r><w:t xml:space="preserve">${escape(r)}</w:t></w:r>`
      : "inserted" in r
        ? `<w:ins ${mark()}><w:r><w:t xml:space="preserve">${escape(r.inserted)}</w:t></w:r></w:ins>`
        : `<w:del ${mark()}><w:r><w:delText xml:space="preserve">${escape(r.deleted)}</w:delText></w:r></w:del>`;
  const body = paragraphs.map((p) => `<w:p>${p.map(run).join("")}</w:p>`);
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipSync({
    "[Content_Types].xml": strToU8(
      `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    "word/document.xml": strToU8(
      `${xml}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}</w:body></w:document>`,
    ),
  });
}
