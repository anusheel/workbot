import { z } from "zod";

/** The 4 kinds of document WorkBot reads, each as the record it should become. */
export const documentTypes = ["invoice", "email", "letter", "job"] as const;
export type DocumentType = (typeof documentTypes)[number];

const asWritten = (what: string) =>
  z.string().nullable().describe(`${what}, as written, or null when absent`);
const date = (what: string) =>
  z
    .string()
    .nullable()
    .describe(`${what} as YYYY-MM-DD, or null when the document gives none`);

export const Invoice = z.object({
  vendor: z.string().describe("who is billing"),
  vendorEmail: asWritten("the vendor's email address"),
  vendorPhone: asWritten("the vendor's phone number"),
  number: asWritten("the invoice number"),
  date: date("the invoice date"),
  due: date("the due date"),
  currency: z.string().describe("ISO code, such as USD"),
  lines: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unitPrice: z.number().nullable(),
      amount: z.number(),
    }),
  ),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number(),
  terms: asWritten("the payment terms, such as net 30"),
});

export const Email = z.object({
  from: z.string().describe("the sender, as written in the From line"),
  to: z.array(z.string()).describe("every recipient"),
  subject: asWritten("the subject line"),
  intent: z
    .enum(["question", "request", "information", "complaint"])
    .describe(
      "complaint: something went wrong, even when a fix is asked for; request: something to be done, nothing went wrong; question: an answer is wanted; information: nothing is asked",
    ),
  actions: z.array(z.string()).describe("what the sender asks to be done"),
  urgency: z.enum(["low", "medium", "high"]),
});

/** Letters and filled forms: what they state and what they ask for. */
export const Letter = z.object({
  from: z.string().describe("who sent or filled it"),
  to: asWritten("who it is addressed to"),
  date: date("its date"),
  subject: z.string().describe("what it is about, in a few words"),
  summary: z.string().describe("what it says, in 2 sentences"),
  fields: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .describe(
      "every labelled field of a form, or the facts a letter states: references, dates, amounts, names",
    ),
  requested: z.array(z.string()).describe("what the sender asks for"),
});

export const JobPosting = z.object({
  title: z.string(),
  company: z.string(),
  location: asWritten("where the job is"),
  salary: z
    .object({
      min: z.number(),
      max: z.number(),
      currency: z.string(),
      period: z.enum(["year", "month", "day", "hour"]),
    })
    .nullable()
    .describe("the range as the posting gives it, or null when it gives none"),
  requirements: z.array(z.string()),
  responsibilities: z.array(z.string()),
  workplace: z.enum(["remote", "hybrid", "onsite"]).nullable(),
});

export const schemas = {
  invoice: Invoice,
  email: Email,
  letter: Letter,
  job: JobPosting,
} as const;

export type Extracted = {
  [K in DocumentType]: { type: K; data: z.infer<(typeof schemas)[K]> };
}[DocumentType];
