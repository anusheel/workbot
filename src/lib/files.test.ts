import { strToU8, zipSync } from "fflate";
import { expect, test } from "vitest";
import { pdf } from "@/test/pdf";
import { docxFrom, docxText, formatOf, pdfPages, scanned } from "./files";

test("a file is known by its bytes, the Office formats by the part inside the zip", () => {
  expect(formatOf(pdf("x"))).toBe("pdf");
  expect(formatOf(docxFrom([["Hello"]]))).toBe("docx");
  expect(formatOf(zipSync({ "xl/workbook.xml": strToU8("<workbook/>") }))).toBe(
    "xlsx",
  );
  expect(formatOf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("png");
  expect(formatOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  expect(formatOf(strToU8("just text"))).toBeUndefined();
  expect(formatOf(zipSync({ "notes.txt": strToU8("x") }))).toBeUndefined();
  expect(formatOf(strToU8("PK but no archive"))).toBeUndefined();
});

test("a PDF's text layer is read page by page, and a page without one counts as scanned", async () => {
  const typed = await pdfPages(
    pdf(
      "Invoice 4471 from Tamarack Fleet Services, total due USD 7200.00, terms net 30 days from the date of this invoice",
    ),
  );
  expect(typed[0]).toContain("Invoice 4471");
  expect(scanned(typed)).toBe(false);
  expect(scanned(await pdfPages(pdf()))).toBe(true);
});

test("the caller keeps a PDF after its text is read", async () => {
  const file = pdf("Kept");
  await pdfPages(file);
  expect(formatOf(file)).toBe("pdf");
});

test("a Word document's tracked changes stay visible, and its paragraphs stay apart", () => {
  const file = docxFrom([
    ["Supply Agreement"],
    [
      "Either party may end this agreement on ",
      { deleted: "30" },
      { inserted: "60" },
      " days' written notice.",
    ],
    ["Payment is due ", { inserted: "within 45 days of " }, "invoice."],
    ["Fieldstone & Co. <the Customer>"],
  ]);
  expect(docxText(file)).toBe(
    "Supply Agreement\nEither party may end this agreement on [-30-][+60+] days' written notice.\nPayment is due [+within 45 days of +]invoice.\nFieldstone & Co. <the Customer>",
  );
});

test("the mark a deleted paragraph leaves does not open a change", () => {
  const xml =
    '<?xml version="1.0"?><w:document xmlns:w="w"><w:body><w:p><w:pPr><w:rPr><w:del w:id="1" w:author="A" w:date="2026-01-01T00:00:00Z"/></w:rPr></w:pPr><w:r><w:t>Kept</w:t></w:r></w:p><w:p><w:r><w:t>Next</w:t></w:r></w:p></w:body></w:document>';
  const file = zipSync({ "word/document.xml": strToU8(xml) });
  expect(docxText(file)).toBe("Kept\nNext");
});

test("characters written by number read as themselves", () => {
  const xml =
    '<?xml version="1.0"?><w:document xmlns:w="w"><w:body><w:p><w:r><w:t>Buyer&#x2019;s notice &#8212; 30 days &amp; no more</w:t></w:r></w:p></w:body></w:document>';
  const file = zipSync({ "word/document.xml": strToU8(xml) });
  expect(docxText(file)).toBe("Buyer’s notice — 30 days & no more");
});
