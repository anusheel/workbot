"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  NewRequest,
  createRequest,
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
  await createRequest(parsed.data);
  redirect("/requests");
}

export async function setStatus(id: string, status: string) {
  await updateRequest(id, { status: z.enum(statuses).parse(status) });
  refresh();
}
