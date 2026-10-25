import { type LanguageModel, Output, generateText } from "ai";
import { io } from "next/cache";
import { z } from "zod";
import { query } from "./db";
import {
  type DocumentType,
  type Extracted,
  documentTypes,
  schemas,
} from "./document-model";
import { type Extraction, type Source, content, extract } from "./extract";
import { NewRequest, type WorkRequest } from "./request-model";
import { createRequest } from "./requests";

export type DocumentRecord = {
  id: string;
  requestId: string;
  type: DocumentType;
  name: string;
  data: Extracted["data"];
  confidence: Record<string, number>;
  review: string[];
  createdAt: Date;
};

const Kind = z.object({
  type: z
    .enum(documentTypes)
    .describe(
      "invoice: a bill for goods or services; email: a message with a sender and recipients; job: a job posting; letter: a letter or a filled form",
    ),
});

/** Which of the 4 kinds a document is, so the right schema is used. */
export async function classify(
  source: Source,
  model: LanguageModel,
): Promise<DocumentType> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: Kind }),
    instructions: "Name the kind of document.",
    messages: [{ role: "user", content: await content(source) }],
  });
  return output.type;
}

const money = (currency: string, amount: number) =>
  `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

/** The work a document asks for: a title, a team and a priority by its kind, the record's substance as the body. */
export function toRequest(document: Extracted): NewRequest {
  switch (document.type) {
    case "invoice": {
      const { vendor, number, currency, total, due, lines, terms } =
        document.data;
      return NewRequest.parse({
        title: `Pay ${vendor} invoice${number ? ` ${number}` : ""}, ${money(currency, total)}`,
        body: `${due ? `Due ${due}. ` : ""}${terms ? `Terms: ${terms}. ` : ""}\n\n${list(lines.map((l) => `${l.description}: ${money(currency, l.amount)}`))}`,
        team: "finance",
        priority: due ? "normal" : "low",
      });
    }
    case "email": {
      const { from, subject, intent, actions, urgency } = document.data;
      return NewRequest.parse({
        title: subject ?? actions[0] ?? `Email from ${from}`,
        body: `From ${from} (${intent}).\n\n${list(actions)}`,
        team:
          intent === "complaint" || intent === "question"
            ? "support"
            : "operations",
        priority:
          urgency === "high" ? "high" : urgency === "low" ? "low" : "normal",
      });
    }
    case "letter": {
      const { from, subject, summary, requested } = document.data;
      return NewRequest.parse({
        title: subject,
        body: `From ${from}. ${summary}\n\n${list(requested)}`,
        team: "operations",
        priority: "normal",
      });
    }
    case "job": {
      const { title, company, location, workplace } = document.data;
      return NewRequest.parse({
        title: `Hiring: ${title} at ${company}`,
        body: [location, workplace].filter(Boolean).join(", "),
        team: "operations",
        priority: "low",
      });
    }
  }
}

const columns = `id, request_id as "requestId", type, name, data, confidence, review, created_at as "createdAt"`;

export async function saveDocument(
  requestId: string,
  document: Pick<
    DocumentRecord,
    "type" | "name" | "data" | "confidence" | "review"
  >,
): Promise<DocumentRecord> {
  const [row] = await query<DocumentRecord>(
    `insert into documents (request_id, type, name, data, confidence, review) values ($1, $2, $3, $4, $5, $6) returning ${columns}`,
    [
      requestId,
      document.type,
      document.name,
      document.data,
      document.confidence,
      document.review,
    ],
  );
  return row;
}

export async function listDocuments(
  requestId: string,
): Promise<DocumentRecord[]> {
  await io();
  return query<DocumentRecord>(
    `select ${columns} from documents where request_id = $1 order by created_at`,
    [requestId],
  );
}

/**
 * Document intake: a document of any of the 4 kinds becomes a request for
 * the right team, with the extracted record filed on it for review.
 */
export async function ingest(
  source: Source,
  name: string,
  model: LanguageModel,
): Promise<{ request: WorkRequest; document: DocumentRecord }> {
  const type = await classify(source, model);
  const extraction: Extraction<Extracted["data"]> = await extract(
    source,
    schemas[type],
    model,
  );
  const extracted = { type, data: extraction.data } as Extracted;
  const request = await createRequest(toRequest(extracted));
  const document = await saveDocument(request.id, {
    type,
    name,
    data: extraction.data,
    confidence: extraction.confidence,
    review: extraction.review,
  });
  return { request, document };
}
