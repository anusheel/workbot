import type { Metadata } from "next";
import dossier from "../../research/dossier.json";
import { site } from "../../site";

export const metadata: Metadata = {
  title:
    "How independent building-supply dealers take orders and pay suppliers",
  description: dossier.summary[0],
};

const badge = {
  high: "bg-emerald-100 text-emerald-900",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-neutral-200 text-neutral-700",
};

export default function Research() {
  const structured = {
    "@context": "https://schema.org",
    "@type": "Report",
    name: dossier.question,
    author: { "@type": "Person", name: site.author },
    dateModified: site.updated,
    citation: dossier.sources.map((s) => s.url),
  };
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
      />
      <p className="text-sm font-medium text-neutral-500">Research</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance">
        {dossier.question}
      </h1>
      <ul className="mt-8 space-y-3 text-neutral-700">
        {dossier.summary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <h2 className="mt-12 font-medium">
        {dossier.claims.length} claims from {dossier.sources.length} sources
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        High: two or more independent sources agree, or a survey with a stated
        method. Medium: one credible source. Low: a vendor&apos;s claim or a
        single unclear source. The dataset is{" "}
        <a href="/research/dossier.json" className="underline">
          dossier.json
        </a>
        .
      </p>
      <ol className="mt-6 space-y-5">
        {dossier.claims.map((c) => (
          <li key={c.claim} className="text-sm">
            <span
              className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${badge[c.confidence as keyof typeof badge]}`}
            >
              {c.confidence}
            </span>
            {c.claim}
            <span className="mt-1 block text-xs text-neutral-500">
              {c.crossCheck}; {c.note}{" "}
              {c.sources.map((url, i) => (
                <a key={url} href={url} className="underline">
                  [{i + 1}]
                </a>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
