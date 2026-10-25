import { parseArgs } from "node:util";
import { z } from "zod";
import { modelFor } from "@/lib/routing";
import { close } from "@/lib/db";
import { scrape } from "@/lib/scrape";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { pages: { type: "string", default: "1" } },
});
const [url] = positionals;
if (!url) {
  console.error("Usage: pnpm scrape <url> [--pages 3]");
  process.exit(1);
}

// What a supplier's public page tells us: the fields the vendor record wants.
const Supplier = z.object({
  name: z.string(),
  hours: z.string().nullable().describe("opening hours as written, or null"),
  services: z.array(z.string()).describe("services or product lines offered"),
  prices: z
    .array(z.object({ item: z.string(), price: z.string() }))
    .describe("any prices shown, as written"),
  contact: z.string().nullable().describe("phone, email or address, or null"),
});

const suppliers = await scrape(url, Supplier, modelFor("extract"), {
  pages: Number(values.pages),
});
console.log(JSON.stringify(suppliers, null, 2));
await close();
