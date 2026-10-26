import { z } from "zod";
import { inngest } from "@/inngest/client";
import { documentReceived } from "@/inngest/events";
import { authorized } from "@/lib/auth";
import { fileSizeError, mediaTypeOf } from "@/lib/extract";
import { type Stored, discard, receive } from "@/lib/inbox";
import { DocumentBody } from "./types";

type Input = { name: string; mediaType: Stored; bytes: Uint8Array };
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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = mediaTypeOf(bytes);
  if (!mediaType)
    return refuse(
      "document must be a PDF, a Word document or an image (PNG, JPEG, WebP)",
    );
  return { name: file.name, mediaType, bytes };
}

function fromBody(body: unknown): Input | Invalid {
  const parsed = DocumentBody.safeParse(body);
  if (!parsed.success) return { error: z.flattenError(parsed.error) };
  const encode = (text: string) => new TextEncoder().encode(text);
  return "url" in parsed.data
    ? {
        name: parsed.data.url,
        mediaType: "text/uri-list",
        bytes: encode(parsed.data.url),
      }
    : {
        name: "text",
        mediaType: "text/plain",
        bytes: encode(parsed.data.text),
      };
}

/**
 * A document in: checked at the door, kept in the inbox under its sender,
 * and handed to the approval workflow, which reads it with the model, a
 * job of seconds that has no place in a request. The answer is 202 with
 * where to follow it.
 */
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
  const item = await receive(input.name, input.mediaType, input.bytes, user.id);
  // The row and its event go together: an upload the engine never heard of is removed, not stranded.
  await inngest
    .send(documentReceived.create({ id: item.id, owner: user.id }))
    .catch(async (error: unknown) => {
      await discard([item.id]);
      throw error;
    });
  const location = `/api/documents/${item.id}`;
  return Response.json(
    { id: item.id, status: item.status, location },
    { status: 202, headers: { location } },
  );
}
