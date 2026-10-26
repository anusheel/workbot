import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { questions, site } from "../../../site";

export function generateStaticParams() {
  return questions.map(({ slug }) => ({ slug }));
}

const find = (slug: string) => questions.find((q) => q.slug === slug);

export async function generateMetadata({
  params,
}: PageProps<"/questions/[slug]">): Promise<Metadata> {
  const q = find((await params).slug);
  return q ? { title: q.question, description: q.answer } : {};
}

export default async function Question({
  params,
}: PageProps<"/questions/[slug]">) {
  const q = find((await params).slug);
  if (!q) notFound();
  // The question and its answer as structured data, which answer engines read before the page.
  const structured = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      },
    ],
    author: { "@type": "Person", name: site.author },
    dateModified: site.updated,
  };
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
      />
      <p className="text-sm font-medium text-neutral-500">
        <Link href="/" className="hover:underline">
          WorkBot
        </Link>
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance">
        {q.question}
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-neutral-700">
        {q.answer}
      </p>
    </main>
  );
}
