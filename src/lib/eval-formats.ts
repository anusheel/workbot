import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import type { Browser } from "playwright-core";
import { type Run, docxFrom } from "./files";

/** A paragraph written with its tracked changes inline, [+inserted+] and [-deleted-], as runs. */
export const runs = (text: string): Run[] =>
  text
    .split(/(\[\+.*?\+\]|\[-.*?-\])/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("[+")
        ? { inserted: part.slice(2, -2) }
        : part.startsWith("[-")
          ? { deleted: part.slice(2, -2) }
          : part,
    );

export type ContractCase = {
  name: string;
  bytes: Uint8Array;
  want: Record<string, unknown>;
};

/** The contracts of content/eval/contracts.json as Word documents, each change tracked under its author. */
export async function contractCases(): Promise<ContractCase[]> {
  const specs: Record<
    string,
    { author: string; text: string[]; want: Record<string, unknown> }
  > = JSON.parse(await readFile("content/eval/contracts.json", "utf8"));
  return Object.entries(specs).map(([name, { author, text, want }]) => ({
    name,
    bytes: docxFrom(text.map(runs), author),
    want,
  }));
}

/**
 * An HTML document printed twice: as a PDF with a text layer, and as a scan,
 * a grey and slightly crooked photograph of the page printed to a PDF with
 * no text in it.
 */
export async function printed(browser: Browser, html: string) {
  const page = await browser.newPage({
    viewport: { width: 900, height: 1200 },
  });
  await page.setContent(html);
  const text = await page.pdf({ format: "A4" });
  const photo = await page.screenshot({ fullPage: true });
  await page.setContent(
    `<body style="margin:0"><img src="data:image/png;base64,${photo.toString("base64")}" style="width:100%;filter:grayscale(1) contrast(1.15);transform:rotate(-0.5deg)"></body>`,
  );
  const scan = await page.pdf({ format: "A4" });
  await page.close();
  return { text: new Uint8Array(text), scan: new Uint8Array(scan) };
}

export type Order = {
  id: string;
  date: Date;
  region: string;
  rep: string;
  channel: string;
  product: string;
  units: number;
  price: number;
  discount: number;
  total: number;
};

/** A seeded generator (mulberry32), so the export and its answers are the same on every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const reps: Record<string, string[]> = {
  "East Bay": ["Dana Whitfield", "Marcus Lee", "Priya Raman"],
  Peninsula: ["Tom Alvarez", "Grace Kim", "Ben Okafor"],
  "South Bay": ["Lucia Moreno", "Sam Patel", "Ivy Chen"],
  "North Bay": ["Owen Price", "Nora Haddad", "Eli Brooks"],
};
const products: [string, number][] = [
  ["Drywall sheet, 4 x 8 ft", 14.75],
  ["Portland cement, 94 lb", 15.25],
  ["Stud, 2 x 4 x 8 ft", 4.85],
  ["Plywood, 3/4 in, 4 x 8 ft", 62.4],
  ["Roofing shingles, bundle", 38.9],
  ["Deck screws, 5 lb", 41.5],
  ["Insulation roll, R-13", 52.0],
  ["Concrete block, 8 in", 2.65],
];
const channels = ["Counter", "Phone", "Online", "Contractor account"];
// Building supply follows the building season: more in summer, less in winter.
const season = [0.6, 0.65, 0.85, 1, 1.1, 1.2, 1.25, 1.2, 1.05, 0.95, 0.8, 0.9];
const round2 = (n: number) => Math.round(n * 100) / 100;

/** 2025's sales orders, sorted by date: the same orders for the same seed. */
export function salesOrders(count = 50_000, seed = 2025): Order[] {
  const random = seeded(seed);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const weight = season.reduce((a, b) => a + b);
  const orders = Array.from({ length: count }, () => {
    let r = random() * weight;
    let month = 0;
    while (r > season[month]) r -= season[month++];
    const date = new Date(Date.UTC(2025, month, 1 + Math.floor(random() * 28)));
    const region = pick(Object.keys(reps));
    const [product, price] = pick(products);
    const units = 1 + Math.floor(random() ** 2 * 60);
    const discount = pick([0, 0, 0, 0.05, 0.1, 0.15]);
    return {
      date,
      region,
      rep: pick(reps[region]),
      channel: pick(channels),
      product,
      units,
      price,
      discount,
      total: round2(units * price * (1 - discount)),
    };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
  return orders.map((order, i) => ({
    id: `SO-${100_001 + i}`,
    ...order,
  }));
}

/** The orders as an export from the order system: a merged title, the header, a formula per total, and a totals row. */
export async function salesExport(orders: Order[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Orders");
  sheet.addRow(["Fieldstone Supply · Sales orders, 2025"]);
  sheet.mergeCells("A1:J1");
  sheet.addRow([]);
  sheet.addRow([
    "Order",
    "Date",
    "Region",
    "Sales rep",
    "Channel",
    "Product",
    "Units",
    "Unit price",
    "Discount",
    "Total",
  ]);
  orders.forEach((o, i) => {
    const r = i + 4;
    sheet.addRow([
      o.id,
      o.date,
      o.region,
      o.rep,
      o.channel,
      o.product,
      o.units,
      o.price,
      o.discount,
      { formula: `ROUND(G${r}*H${r}*(1-I${r}),2)`, result: o.total },
    ]);
  });
  const last = orders.length + 3;
  const sum = (key: "units" | "total") =>
    round2(orders.reduce((n, o) => n + o[key], 0));
  sheet.addRow([
    "Total",
    ...Array(5).fill(null),
    { formula: `SUM(G4:G${last})`, result: sum("units") },
    null,
    null,
    { formula: `SUM(J4:J${last})`, result: sum("total") },
  ]);
  sheet.getColumn(2).numFmt = "yyyy-mm-dd";
  sheet.getColumn(9).numFmt = "0%";
  return new Uint8Array(await book.xlsx.writeBuffer());
}

/** What a question should come back with: a name the answer must give, a figure it must state, or both. */
export type Truth = { text?: string; figure: number };
export type SheetQuestion = { question: string; truth(orders: Order[]): Truth };

const quarter = (o: Order) => Math.floor(o.date.getUTCMonth() / 3) + 1;
const month = (o: Order) => o.date.getUTCMonth() + 1;
/** The key with the largest sum, and the sum. */
function top(
  orders: Order[],
  key: (o: Order) => string,
  value: (o: Order) => number,
) {
  const sums = new Map<string, number>();
  for (const o of orders) sums.set(key(o), (sums.get(key(o)) ?? 0) + value(o));
  const [text, figure] = [...sums].sort((a, b) => b[1] - a[1])[0];
  return { text, figure: round2(figure) };
}
const revenue = (orders: Order[]) =>
  round2(orders.reduce((n, o) => n + o.total, 0));

/** Five questions an operations lead asks of a year's orders, each answered here by code over the orders themselves. */
export const sheetQuestions: SheetQuestion[] = [
  {
    question:
      "Which region had the most revenue in the third quarter, and how much was it?",
    truth: (orders) =>
      top(
        orders.filter((o) => quarter(o) === 3),
        (o) => o.region,
        (o) => o.total,
      ),
  },
  {
    question:
      "How many orders came in through contractor accounts in the fourth quarter?",
    truth: (orders) => ({
      figure: orders.filter(
        (o) => quarter(o) === 4 && o.channel === "Contractor account",
      ).length,
    }),
  },
  {
    question: "Which product sold the most units over the year, and how many?",
    truth: (orders) =>
      top(
        orders,
        (o) => o.product,
        (o) => o.units,
      ),
  },
  {
    question:
      "Which sales rep brought in the most revenue in December, and how much?",
    truth: (orders) =>
      top(
        orders.filter((o) => month(o) === 12),
        (o) => o.rep,
        (o) => o.total,
      ),
  },
  {
    question: "How much more revenue did December bring in than November?",
    truth: (orders) => ({
      figure: round2(
        revenue(orders.filter((o) => month(o) === 12)) -
          revenue(orders.filter((o) => month(o) === 11)),
      ),
    }),
  },
];

/**
 * Whether a written answer states a figure, to the precision it was written
 * in: "$1.24 million" states 1,238,410.17, and "4,812" states 4,812.
 */
export function states(answer: string, figure: number): boolean {
  for (const [, digits, scale] of answer.matchAll(
    /(\d[\d,]*(?:\.\d+)?)(?:\s*(million|thousand|[mk])\b)?/gi,
  )) {
    const multiplier = !scale ? 1 : /^m/i.test(scale) ? 1e6 : 1e3;
    const decimals = digits.split(".")[1]?.length ?? 0;
    const value = Number(digits.replace(/,/g, "")) * multiplier;
    if (
      Math.abs(value - Math.abs(figure)) <=
      (0.5 * multiplier) / 10 ** decimals + 1e-9
    )
      return true;
  }
  return false;
}

/** An answer is right when it names what the truth names and states its figure. */
export const answered = (answer: string, { text, figure }: Truth) =>
  (!text || answer.toLowerCase().includes(text.toLowerCase())) &&
  states(answer, figure);
