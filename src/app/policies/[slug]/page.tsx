import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { getPolicy, listPolicies } from "@/lib/policies";

export async function generateStaticParams() {
  return (await listPolicies()).map(({ slug }) => ({ slug }));
}

export default async function PolicyPage(props: PageProps<"/policies/[slug]">) {
  const policy = await getPolicy((await props.params).slug);
  if (!policy) notFound();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <Button asChild variant="ghost" size="sm" className="-ml-2.5">
        <Link href="/policies">
          <ArrowLeft /> Policies
        </Link>
      </Button>
      <article className="mt-6 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          {policy.owner} · updated {policy.updated}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {policy.title}
        </h1>
        <div className="prose prose-neutral mt-8 prose-headings:font-semibold prose-headings:tracking-tight">
          <Markdown>{policy.body}</Markdown>
        </div>
      </article>
    </main>
  );
}
