# Documents and spreadsheets

What WorkBot reads, by which path each file reaches the model, and what the measurement on 2026-10-25 says about the choice. The code is `src/lib/files.ts` (formats), `src/lib/extract.ts` (the router), `src/lib/sheets.ts` (spreadsheets) and `cli/formats.ts` (the measurement).

## A file is what its bytes say

The browser's declared type and the file name are not trusted. `formatOf` reads the first bytes: `%PDF` is a PDF, the PNG, JPEG and WebP signatures are images, and a zip is a Word document when it holds `word/document.xml` and an Excel workbook when it holds `xl/workbook.xml`. Anything else is refused at the upload.

| Format                 | Path to the model                                            | Where it arrives                                          |
| ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| PDF with a text layer  | its text, page by page                                       | new request, inbox, `POST /api/documents`, `pnpm extract` |
| PDF without one (scan) | the file: the model sees each page as an image and as text   | the same                                                  |
| Image                  | the file                                                     | the same                                                  |
| Word document          | its text, with tracked changes marked                        | the same                                                  |
| Excel workbook         | never: it is loaded into a database and the model writes SQL | `/admin/sheets`                                           |

## Two paths for a PDF

A PDF can reach the model as its text, extracted here, or as the file, which the provider turns into page images and text. The router (`route` in `src/lib/extract.ts`) extracts the text layer with pdf.js and counts the letters and digits on each page: 50 or more on average is a text PDF and goes as text; fewer is a scan, a photograph of paper with no text to extract, and goes as the file. A PDF whose text cannot be read at all goes as the file too, for the model to try. `ingest(source, name, model, "native")` forces the file, which is how the measurement compares the paths on one document.

The text path loses layout. A page laid out in columns comes back as lines in reading order, and a heading that wrapped is two lines; the measurement found exactly that. The file path keeps the layout and costs a page image per page, so its cost grows with the page count while the text's grows with the words.

## Word documents and tracked changes

A Word document is a zip of XML. `docxText` reads `word/document.xml` in one pass: paragraphs become lines, table cells are separated by a bar, and a tracked change keeps its place in the sentence, an insertion as `[+60+]` and a deletion as `[-30-]`. A contract is read for what it would say with the changes accepted, and each change is listed in the record's `changes`, so a reviewer sees that the notice period moved from 30 to 60 days rather than only that it is 60. For a report, where changes are noise, the same reader with the markers dropped gives the clean text. `docxFrom` writes a Word document from paragraphs of runs, changes included: the output side of a template, and the fixtures here.

## Spreadsheets: the model writes SQL

A 50,000-row export is about 3 MB of text, past any prompt and wasteful where it fits. The sheet goes into a database instead, and the model asks it questions.

Reading (`readSheet`): the first worksheet is the table. The header is the first of the top 10 rows whose cells are all distinct text, so a title merged across the columns above it is passed over. A merged cell reads as the cell it was merged from, a formula as its last calculated result, rich text as its characters. Each column gets one type when every value agrees, number, date, timestamp or yes/no, and text otherwise; a date stored without a date format arrives as a serial number and stays a number, which a cleaning step would have to fix. A last row labelled Total is taken off the data and each of its figures is compared with the sum of its column, so a sheet whose totals do not reconcile says so on its page before anyone asks it anything.

The sandbox (`withSandbox`): a DuckDB of its own, in memory, built from the stored file for each question and closed after it, with external access, extension loading and configuration changes off. A query is checked before it runs: one statement, of type SELECT. It returns at most 50 rows, with a flag when there were more, and is interrupted after 5 seconds. Rebuilding the database for each question takes about a second for 50,000 rows, against the several seconds of the model's turns, so there is no cache to invalidate.

Asking (`ask`): the model is told the columns with their types and headers, a reserved word such as `order` shown quoted, and three rows. It answers by calling the `query` tool as often as it needs, and the answer comes back with every query it ran, the refused ones included, and the rows each returned. The page shows them under the answer, so a reader checks the SQL rather than trusting the sentence. The task is routed as `analyze`.

## The measurement

`pnpm formats` reads 10 invoices by every path, 10 contracts and the 5 questions; `--save <dir>` writes the files it built, to upload by hand. The invoices are `content/eval/documents/invoice-*.html` printed by Chrome, once with a text layer and once as a scan (a grey, slightly crooked screenshot printed to a PDF with no text in it). The contracts are `content/eval/contracts.json`, each paragraph written with its changes inline and built into a Word document. The sales export is generated from a seed, 50,000 orders of 2025 with a merged title, a formula per total and a totals row, and each question's answer is computed by code over the same orders. A field is right as the extraction eval judges it; an answer is right when it names what the code found and states its figure to the precision it is written in.

### Invoices: 10 documents, 11 pages, three paths

| Path                     | Chosen by the router | Fields right | Input tokens a document | Cost a document |
| ------------------------ | -------------------- | ------------ | ----------------------- | --------------- |
| Text layer               | 10 of 10 text PDFs   | 0.99         | 1,648                   | $0.0006         |
| The file, text PDF       | forced, to compare   | 1.00         | 3,401                   | $0.0009         |
| The file, the same scans | 10 of 10 scans       | 1.00         | 2,876                   | $0.0008         |

The paths disagreed on one field of one document. On `invoice-9`, whose header sets the vendor's name in a narrow column, the text layer gave "Bayside Electrical": the name had wrapped onto two lines and the model took the first. The file was right. The scans, crooked and grey, read as well as the clean files.

The file sends about 1,600 more input tokens a page, the page image. It cost only a third more here because the record the model writes back, about 1,000 tokens, is most of the bill at the small model's prices. The saving grows with the page count and with the model's price.

### Contracts: 10 Word documents with tracked changes

Every graded field was right on all 10: title, parties, effective and end dates, renewal, notice, governing law, and every tracked change, at $0.0008 a contract. Where a change moved a graded field, from Delaware to California or from 30 to 45 days, the field held the changed value and `changes` held both sides. These contracts are short and were written for the test; a real contract has more clauses and more ways to be read, and needs real ones in the set.

### The sales export: 50,000 rows, 5 questions

The export, 2.8 MB, is read in 0.8 s and its totals row reconciles for units and revenue.

| Model | Right  | Queries a question | Cost a question |
| ----- | ------ | ------------------ | --------------- |
| Small | 5 of 5 | 1.2                | $0.0004         |
| Large | 5 of 5 | 1.6                | $0.0088         |

Each answer rests on one aggregate query, grouped and sorted in SQL, never on rows read by the model. The small model's one extra query listed the channels to find the exact name "Contractor account". The large model spent its extra queries checking the data, the date range, missing values or duplicate order numbers, and said so in its answers.

## The decision

A PDF with a text layer goes as its text, and a scan goes as the file: the accuracy was the same within what 10 documents can show, the text costs less and the gap grows with pages. The text path's cost is layout, which lost one field in 10; a document whose meaning is in its layout, a form or a page in columns, should go as the file, which today is a parameter of `ingest` rather than a setting. Word documents go as their text with changes marked, since the model takes no Word files and the marks carry what a reviewer needs. Spreadsheets go to SQL on the small model, routed as `analyze`: 5 of 5 at a twentieth of the large model's cost. Recorded as D20.

## What is not here

- Mixed documents split by region, a table to one path and a photograph to another: every page of a PDF goes one way, and the router averages the pages, so a typed cover on top of scanned pages can send the whole file as text and lose the scans.
- OCR as a separate step: a scan goes to a model that reads images, which on these 10 was enough.
- Older formats: `.doc`, `.xls` and CSV are refused; a CSV would load into the same sandbox in a few lines.
- More than one worksheet, and joins across sheets: the first worksheet is the table.
- The model proposing a cleaning plan for a messy sheet (dates as serial numbers, units in the header): types are inferred in code from every value, which is exact for exports like this one and wrong for sheets typed by hand.
