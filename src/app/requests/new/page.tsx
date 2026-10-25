import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Allowed } from "@/components/allowed";
import { FileUpload } from "@/components/file-upload";
import { Track } from "@/lib/analytics";
import { priorities, teams } from "@/lib/requests";
import { submitDocument } from "../actions";
import { RequestForm } from "./request-form";
import { customer } from "@/lib/customer";

// Reading a document is a few model calls; the action waits for them.
export const maxDuration = 120;

export const metadata: Metadata = { title: "New request" };

export default function NewRequestPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe what you need and which team should pick it up.
        </p>
        <Suspense>
          <Allowed
            role="agent"
            fallback={
              <p className="mt-8 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                Filing a request takes the agent role; your role reads them.
              </p>
            }
          >
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
              <FileUpload
                action={submitDocument}
                name="document"
                accept=".pdf,image/png,image/jpeg,image/webp"
                label="File it from a document"
                busy="Reading the document…"
                icon={<FileText />}
              />
              <span className="text-sm text-muted-foreground">
                An invoice, an email, a letter or a form, as a PDF or an image.
                {customer.assistant} reads it and files the request.
              </span>
            </div>
            <div className="mt-8">
              <RequestForm teams={teams} priorities={priorities} />
            </div>
          </Allowed>
        </Suspense>
        <Suspense>
          <Track event="request_form_viewed" />
        </Suspense>
      </div>
    </main>
  );
}
