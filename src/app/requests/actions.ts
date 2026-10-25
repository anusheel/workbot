"use server";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { chatModel } from "@/lib/chat";
import { investigate } from "@/lib/investigate";
import { getRecording, saveRecording } from "@/lib/recordings";
import { saveReport } from "@/lib/reports";
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

export type FormState = {
  errors?: Partial<Record<keyof NewRequest, string[]>>;
};

export async function submitRequest(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
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
  const next = z.enum(statuses).parse(status);
  await updateRequest(id, { status: next });
  await track("request_status_changed", { requestId: id, status: next });
  refresh();
}

/** Runs the analyst on the request and files its report on the ticket. */
export async function investigateRequest(id: string) {
  const request = await getRequest(id);
  if (!request) return;
  const question = request.body
    ? `${request.title}\n\n${request.body}`
    : request.title;
  const { report, findings, dollars } = await investigate(question, {
    analyst: chatModel(),
    specialist: chatModel("small"),
  });
  await saveReport(id, { report, findings, dollars });
  await track("request_investigated", { requestId: id, dollars });
  refresh();
}

/** Reads an uploaded recording frame by frame and files its timeline on the ticket. */
export async function attachRecording(id: string, formData: FormData) {
  const file = formData.get("recording");
  if (!(file instanceof File) || file.size === 0) return;
  const dir = await mkdtemp(join(tmpdir(), "workbot-recording-"));
  const path = join(dir, basename(file.name) || "recording");
  try {
    await writeFile(path, new Uint8Array(await file.arrayBuffer()));
    const model = chatModel("small");
    const scenes = await describeFrames(await extractFrames(path), model);
    const recording = await saveRecording(id, {
      name: file.name,
      seconds: Math.round(await duration(path)),
      scenes,
      summary: await summarize(scenes, model),
    });
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
  const question = String(formData.get("question") ?? "").trim();
  const recording = await getRecording(recordingId);
  if (!question || !recording) return {};
  const answer = await askRecording(
    recording.scenes,
    question,
    chatModel("small"),
  );
  return { question, answer };
}
