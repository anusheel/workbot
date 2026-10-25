import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvestigateButton } from "@/components/investigate-button";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { latestReport } from "@/lib/reports";
import { getRequest, statusLabels, statuses } from "@/lib/requests";
import { investigateRequest, setStatus } from "../actions";

// An investigation is a few model calls per agent; the action waits for all of them.
export const maxDuration = 300;

export default function RequestPage(props: PageProps<"/requests/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <Button asChild variant="ghost" size="sm" className="-ml-2.5">
        <Link href="/requests">
          <ArrowLeft /> Requests
        </Link>
      </Button>
      <Suspense
        fallback={
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <RequestDetail params={props.params} />
      </Suspense>
    </main>
  );
}

async function RequestDetail({
  params,
}: Pick<PageProps<"/requests/[id]">, "params">) {
  const request = await getRequest((await params).id);
  if (!request) notFound();
  await track("request_viewed", { requestId: request.id });
  return (
    <article className="mt-6 max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {request.team}
        </Badge>
        <Badge variant="secondary">
          <span className="capitalize">{request.priority}</span> priority
        </Badge>
        <Badge>{statusLabels[request.status]}</Badge>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {request.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Filed{" "}
        {request.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
      </p>
      <p className="mt-6 text-sm leading-relaxed whitespace-pre-wrap">
        {request.body || "No details."}
      </p>
      <form className="mt-8 flex gap-2">
        {statuses
          .filter((status) => status !== request.status)
          .map((status) => (
            <Button
              key={status}
              variant="outline"
              formAction={setStatus.bind(null, request.id, status)}
            >
              Mark {statusLabels[status].toLowerCase()}
            </Button>
          ))}
      </form>
      <Research requestId={request.id} />
    </article>
  );
}

async function Research({ requestId }: { requestId: string }) {
  const report = await latestReport(requestId);
  return (
    <section className="mt-12 border-t pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Research</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {report
              ? `Written ${report.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${report.findings.length} findings · $${report.dollars.toFixed(3)}`
              : "The analyst reads the knowledge base and the web and files a sourced report here."}
          </p>
        </div>
        <form>
          <InvestigateButton
            action={investigateRequest.bind(null, requestId)}
            again={Boolean(report)}
          />
        </form>
      </div>
      {report && (
        <div className="mt-5 rounded-xl border bg-card p-6">
          <Markdown>{report.report}</Markdown>
        </div>
      )}
    </section>
  );
}
