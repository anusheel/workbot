"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Asked } from "@/components/sheet-question";
import { requireUser } from "@/lib/auth";
import { fileSizeError } from "@/lib/extract";
import { formatOf } from "@/lib/files";
import { modelFor } from "@/lib/routing";
import { ask, saveSheet, tableOf } from "@/lib/sheets";
import { withTrace } from "@/lib/tracing";

/** A workbook is kept once it reads as a table, and opens on the page where it is asked about. */
export async function uploadSheet(formData: FormData) {
  await requireUser("agent");
  const file = formData.get("sheet");
  if (!(file instanceof File)) return;
  const tooBig = fileSizeError(file.size);
  if (tooBig) throw new Error(`${file.name}: ${tooBig}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (formatOf(bytes) !== "xlsx")
    throw new Error(`${file.name} is not an Excel workbook (.xlsx).`);
  const sheet = await saveSheet(file.name, bytes);
  redirect(`/admin/sheets/${sheet.id}`);
}

const Question = z.string().trim().min(3).max(500);

export async function askSheet(
  id: string,
  _: Asked,
  formData: FormData,
): Promise<Asked> {
  const user = await requireUser("viewer");
  const question = Question.safeParse(formData.get("question"));
  if (!question.success)
    return { error: "Ask a question of 3 to 500 characters." };
  const table = await tableOf(z.uuid().parse(id));
  if (!table) return { error: "That sheet is no longer here." };
  const answer = await withTrace(
    { caller: user.id, role: user.role, user: user.id, name: "sheets" },
    () => ask(table, question.data, modelFor("analyze")),
  );
  return { question: question.data, answer };
}
