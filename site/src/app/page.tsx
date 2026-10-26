import Link from "next/link";
import { questions, site } from "../site";

const features = [
  {
    title: "Requests, from intake to done",
    body: "A form any employee can use, a list the team works from, and a status on every request.",
  },
  {
    title: "Policies in one place",
    body: "The company's rules as plain documents, each owned by a team, readable by everyone.",
  },
  {
    title: "One console for the teams",
    body: "Operations, finance and support see their open work, by status and by priority, in one place.",
  },
];

// What WorkBot is, as structured data for answer engines.
const structured = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "BusinessApplication",
  description:
    "An AI assistant and workflow engine for operations, finance and support teams.",
  url: site.url,
  author: { "@type": "Person", name: site.author },
  dateModified: site.updated,
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-20 px-6 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
      />
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-neutral-500">WorkBot</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance">
          The assistant for the teams that keep a company running
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-neutral-600">
          WorkBot takes in the requests that operations, finance and support
          teams receive, keeps the company&apos;s policies where everyone can
          read them, and gives each team one place to work from.
        </p>
      </section>
      <section className="grid gap-10 border-t border-neutral-200 pt-12 sm:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title}>
            <h2 className="font-medium">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {feature.body}
            </p>
          </div>
        ))}
      </section>
      <section className="border-t border-neutral-200 pt-12">
        <h2 className="font-medium">Questions buyers ask</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {questions.map((q) => (
            <li key={q.slug}>
              <Link href={`/questions/${q.slug}`} className="underline">
                {q.question}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
