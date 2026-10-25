"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { chatModel } from "@/lib/chat";
import { investigate } from "@/lib/investigate";
import { saveReport } from "@/lib/reports";
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
