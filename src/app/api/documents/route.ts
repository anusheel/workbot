import { z } from "zod";
import { track } from "@/lib/analytics";
import { modelFor } from "@/lib/routing";
import { ingest } from "@/lib/documents";
import { type Source, fileSizeError, mediaTypeOf } from "@/lib/extract";
import { withTrace } from "@/lib/tracing";
import { DocumentBody } from "./types";
import { authorized } from "@/lib/auth";

// Classification and extraction are 2 model calls, with retries; a file goes to the model whole.
export const maxDuration = 120;

type Input = { source: Source; name: string };
type Invalid = { error: unknown };

async function fromForm(form: FormData | null): Promise<Input | Invalid> {
  if (!form)
    return {
      error: {
        formErrors: ["the multipart body is malformed"],
        fieldErrors: {},
      },
    };
  const file = form.get("document");
  const refuse = (reason: string) => ({
    error: { formErrors: [reason], fieldErrors: {} },
  });
  if (!(file instanceof File)) return refuse("document must be a file");
  const tooBig = fileSizeError(file.size);
  if (tooBig) return refuse(tooBig);
  // The bytes decide the type, whatever the request declared.
  const data = new Uint8Array(await file.arrayBuffer());
  const mediaType = mediaTypeOf(data);
  if (!mediaType)
    return refuse(
      "document must be a PDF, a Word document or an image (PNG, JPEG, WebP)",
    );
  return { name: file.name, source: { kind: "file", data, mediaType } };
}

function fromBody(body: unknown): Input | Invalid {
  const parsed = DocumentBody.safeParse(body);
  if (!parsed.success) return { error: z.flattenError(parsed.error) };
  return "url" in parsed.data
    ? { name: parsed.data.url, source: { kind: "url", url: parsed.data.url } }
    : { name: "text", source: { kind: "text", text: parsed.data.text } };
}

export async function POST(request: Request) {
  const user = await authorized(request, "agent");
  if (user instanceof Response) return user;
  const input = request.headers
    .get("content-type")
    ?.startsWith("multipart/form-data")
    ? await fromForm(await request.formData().catch(() => null))
    : fromBody(await request.json().catch(() => null));
  if ("error" in input)
    return Response.json({ error: input.error }, { status: 400 });
  const result = await withTrace(
    { caller: user.id, role: user.role, user: user.id, name: "document" },
    () => ingest(input.source, input.name, modelFor("extract")),
  );
  await track("request_submitted", {
    requestId: result.request.id,
    team: result.request.team,
    priority: result.request.priority,
    channel: "document",
  });
  return Response.json(result, { status: 201 });
}
