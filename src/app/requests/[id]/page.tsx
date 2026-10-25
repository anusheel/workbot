import { ArrowLeft, Film, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DocumentFields } from "@/components/document-fields";
import { FileUpload } from "@/components/file-upload";
import { Markdown } from "@/components/markdown";
import { PendingButton } from "@/components/pending-button";
import { RecordingQuestion } from "@/components/recording-question";
import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { schemas } from "@/lib/document-model";
import { listDocuments } from "@/lib/documents";
import { listRecordings } from "@/lib/recordings";
import { latestReport } from "@/lib/reports";
import { getRequest, statusLabels, statuses } from "@/lib/requests";
import { clock } from "@/lib/video";
import {
  askAboutRecording,
  attachRecording,
  investigateRequest,
  setStatus,
} from "../actions";

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
      <Documents requestId={request.id} />
      <Research requestId={request.id} />
      <Recordings requestId={request.id} />
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
          <PendingButton
            formAction={investigateRequest.bind(null, requestId)}
            busy="Investigating…"
            icon={<Search />}
          >
            {report ? "Investigate again" : "Investigate"}
          </PendingButton>
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

async function Recordings({ requestId }: { requestId: string }) {
  const recordings = await listRecordings(requestId);
  return (
    <section className="mt-12 border-t pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Recordings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {recordings.length
              ? `${recordings.length} on this request`
              : "A meeting recording or a video of the problem, read frame by frame and filed here as a timeline."}
          </p>
        </div>
        <FileUpload
          action={attachRecording.bind(null, requestId)}
          name="recording"
          accept="video/*"
          label="Attach a recording"
          busy="Reading the recording…"
          icon={<Film />}
        />
      </div>
      {recordings.map((recording) => (
        <div key={recording.id} className="mt-5 rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">{recording.name}</h3>
            <span className="text-xs text-muted-foreground">
              {clock(recording.seconds)} · read{" "}
              {recording.createdAt.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
            {recording.summary}
          </p>
          <RecordingQuestion
            action={askAboutRecording.bind(null, recording.id)}
          />
        </div>
      ))}
    </section>
  );
}

async function Documents({ requestId }: { requestId: string }) {
  const documents = await listDocuments(requestId);
  if (documents.length === 0) return null;
  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="text-base font-semibold">Documents</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What this request was filed from, as WorkBot read it. Check the marked
        fields.
      </p>
      {documents.map((document) => (
        <div key={document.id} className="mt-5 rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Badge variant="secondary" className="capitalize">
                {document.type}
              </Badge>
              {document.name}
            </h3>
            <span className="text-xs text-muted-foreground">
              read{" "}
              {document.createdAt.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <div className="mt-4">
            <DocumentFields
              data={document.data}
              order={Object.keys(schemas[document.type].shape)}
              review={document.review}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
