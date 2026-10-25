"use server";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { modelFor } from "@/lib/routing";
import { ingest } from "@/lib/documents";
import { type MediaType, mediaTypes } from "@/lib/extract";
import { investigate } from "@/lib/investigate";
import { getRecording, saveRecording } from "@/lib/recordings";
import { saveReport } from "@/lib/reports";
import { withTrace } from "@/lib/tracing";
import type { Answer } from "@/components/recording-question";
import {
  askRecording,
  describeFrames,
  duration,
  extractFrames,
  summarize,
} from "@/lib/video";
import {
  NewRequest,
  createRequest,
  getRequest,
  statuses,
  updateRequest,
} from "@/lib/requests";
import { requireUser } from "@/lib/auth";

export type FormState = {
  errors?: Partial<Record<keyof NewRequest, string[]>>;
};

export async function submitRequest(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser("agent");
  const parsed = NewRequest.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { errors: z.flattenError(parsed.error).fieldErrors };
  const request = await createRequest(parsed.data);
  await track("request_submitted", {
    requestId: request.id,
    team: request.team,
    priority: request.priority,
  });
  redirect("/requests");
}

export async function setStatus(id: string, status: string) {
  await requireUser("agent");
  const next = z.enum(statuses).parse(status);
  if (!(await updateRequest(id, { status: next }))) return;
  await track("request_status_changed", { requestId: id, status: next });
  refresh();
}

/** Runs the analyst on the request and files its report on the ticket. */
export async function investigateRequest(id: string) {
  const user = await requireUser("agent");
  const request = await getRequest(id);
  if (!request) return;
  const question = request.body
    ? `${request.title}\n\n${request.body}`
    : request.title;
  const { report, findings, dollars } = await withTrace(
    { caller: user.id, name: "investigate" },
    () => investigate(question, modelFor("research")),
  );
  await saveReport(id, { report, findings, dollars });
  await track("request_investigated", { requestId: id, dollars });
  refresh();
}

/** Reads an uploaded recording frame by frame and files its timeline on the ticket. */
export async function attachRecording(id: string, formData: FormData) {
  const user = await requireUser("agent");
  const file = formData.get("recording");
  if (!(file instanceof File) || file.size === 0) return;
  const dir = await mkdtemp(join(tmpdir(), "workbot-recording-"));
  const path = join(dir, basename(file.name) || "recording");
  try {
    await writeFile(path, new Uint8Array(await file.arrayBuffer()));
    const model = modelFor("read");
    const recording = await withTrace(
      { caller: user.id, name: "recording" },
      async () => {
        const scenes = await describeFrames(await extractFrames(path), model);
        return saveRecording(id, {
          name: file.name,
          seconds: Math.round(await duration(path)),
          scenes,
          summary: await summarize(scenes, model),
        });
      },
    );
    await track("recording_attached", {
      requestId: id,
      seconds: recording.seconds,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  refresh();
}

/** Answers a question about a recording from what its frames showed. */
export async function askAboutRecording(
  recordingId: string,
  _: Answer,
  formData: FormData,
): Promise<Answer> {
  const user = await requireUser("viewer");
  const question = String(formData.get("question") ?? "").trim();
  const recording = await getRecording(recordingId);
  if (!question || !recording) return {};
  const answer = await withTrace({ caller: user.id, name: "recording" }, () =>
    askRecording(recording.scenes, question, modelFor("read")),
  );
  return { question, answer };
}

const media = new Set<string>(Object.values(mediaTypes));

/** Files a request from an uploaded document: an invoice, an email, a letter or a form, as PDF or image. */
export async function submitDocument(formData: FormData) {
  const user = await requireUser("agent");
  const file = formData.get("document");
  if (!(file instanceof File) || !media.has(file.type)) return;
  const { request } = await withTrace(
    { caller: user.id, name: "document" },
    async () =>
      ingest(
        {
          kind: "file",
          data: new Uint8Array(await file.arrayBuffer()),
          mediaType: file.type as MediaType,
        },
        file.name,
        modelFor("extract"),
      ),
  );
  await track("request_submitted", {
    requestId: request.id,
    team: request.team,
    priority: request.priority,
    channel: "document",
  });
  redirect(`/requests/${request.id}`);
}
