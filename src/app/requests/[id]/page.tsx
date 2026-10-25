import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRequest, statusLabels, statuses } from "@/lib/requests";
import { setStatus } from "../actions";

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
    </article>
  );
}
