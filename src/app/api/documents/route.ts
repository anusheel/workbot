import { z } from "zod";
import { track } from "@/lib/analytics";
import { chatModel } from "@/lib/chat";
import { ingest } from "@/lib/documents";
import { type MediaType, type Source, mediaTypes } from "@/lib/extract";
import { DocumentBody } from "./types";

// Classification and extraction are 2 model calls, with retries; a file goes to the model whole.
export const maxDuration = 120;

type Input = { source: Source; name: string };
type Invalid = { error: unknown };

const media = new Set<string>(Object.values(mediaTypes));

async function fromForm(form: FormData): Promise<Input | Invalid> {
  const file = form.get("document");
  if (!(file instanceof File) || !media.has(file.type))
    return {
      error: {
        formErrors: [
          `document must be a file of a type among ${[...media].join(", ")}`,
        ],
        fieldErrors: {},
      },
    };
  return {
    name: file.name,
    source: {
      kind: "file",
      data: new Uint8Array(await file.arrayBuffer()),
      mediaType: file.type as MediaType,
    },
  };
}

function fromBody(body: unknown): Input | Invalid {
  const parsed = DocumentBody.safeParse(body);
  if (!parsed.success) return { error: z.flattenError(parsed.error) };
  return "url" in parsed.data
    ? { name: parsed.data.url, source: { kind: "url", url: parsed.data.url } }
    : { name: "text", source: { kind: "text", text: parsed.data.text } };
}

export async function POST(request: Request) {
  const input = request.headers
    .get("content-type")
    ?.startsWith("multipart/form-data")
    ? await fromForm(await request.formData())
    : fromBody(await request.json().catch(() => null));
  if ("error" in input)
    return Response.json({ error: input.error }, { status: 400 });
  const result = await ingest(input.source, input.name, chatModel("small"));
  await track("request_submitted", {
    requestId: result.request.id,
    team: result.request.team,
    priority: result.request.priority,
    channel: "document",
  });
  return Response.json(result, { status: 201 });
}
