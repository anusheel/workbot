import { measureCitations } from "@/lib/aeo";

// The weekly measurement, run now: each buyer question to each assistant, and whether the site was cited.
// Usage: SITE_URL=https://<the site> pnpm aeo
const results = await measureCitations();
for (const r of results)
  console.log(
    `${r.cited ? "cited " : "not cited"}  ${r.assistant}  ${r.question}\n           ${r.sources.slice(0, 5).join(", ") || "no sources"}`,
  );
console.log(
  `\n${results.filter((r) => r.cited).length} of ${results.length} answers cite the site.`,
);
