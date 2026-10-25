"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { NewRequest, createRequest } from "@/lib/requests";

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
