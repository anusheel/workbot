import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { ingest, listDocuments, toRequest } from "./documents";
import { NewRequest } from "./request-model";

const scripted = (replies: object[]) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(replies.shift()) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });

test("each kind of document becomes the right request", () => {
  expect(
    toRequest({
      type: "invoice",
      data: {
        vendor: "Acme Supplies",
        vendorEmail: null,
        vendorPhone: null,
        number: "INV-4471",
        date: "2026-10-01",
        due: "2026-10-31",
        currency: "USD",
        lines: [
          {
            description: "Shelving",
            quantity: 4,
            unitPrice: 310,
            amount: 1240,
          },
        ],
        subtotal: 1240,
        tax: 0,
        total: 1240,
        terms: "net 30",
      },
    }),
  ).toEqual({
    title: "Pay Acme Supplies invoice INV-4471, USD 1,240.00",
    body: "Due 2026-10-31. Terms: net 30. \n\n- Shelving: USD 1,240.00",
    team: "finance",
    priority: "normal",
  });
  expect(
    toRequest({
      type: "email",
      data: {
        from: "dana@fieldstone.example",
        to: ["support@fieldstone.example"],
        subject: "Order 4411 arrived damaged",
        intent: "complaint",
        actions: ["Replace the damaged shelf", "Confirm the delivery date"],
        urgency: "high",
      },
    }),
  ).toMatchObject({
    title: "Order 4411 arrived damaged",
    team: "support",
    priority: "high",
  });
  expect(
    toRequest({
      type: "job",
      data: {
        title: "Forklift operator",
        company: "Fieldstone Supply",
        location: "Oakland, CA",
        salary: null,
        requirements: [],
        responsibilities: [],
        workplace: "onsite",
      },
    }),
  ).toMatchObject({
    title: "Hiring: Forklift operator at Fieldstone Supply",
    body: "Oakland, CA, onsite",
    team: "operations",
    priority: "low",
  });
});

test("a filed request fits the request model's limits", () => {
  const email = (subject: string | null) =>
    toRequest({
      type: "email",
      data: {
        from: "dana@fieldstone.example",
        to: ["support@fieldstone.example"],
        subject,
        intent: "question",
        actions: ["Call Dana back"],
        urgency: "medium",
      },
    });
  const long = email("x".repeat(200));
  expect(long.title).toHaveLength(NewRequest.shape.title.maxLength ?? 0);
  expect(long.title.endsWith("…")).toBe(true);
  expect(email("").title).toBe("Call Dana back");
  expect(email("  ").title).toBe("Call Dana back");

  const invoice = toRequest({
    type: "invoice",
    data: {
      vendor: "Acme Supplies",
      vendorEmail: null,
      vendorPhone: null,
      number: null,
      date: "2026-10-01",
      due: null,
      currency: "USD",
      lines: Array.from({ length: 500 }, (_, i) => ({
        description: `Shelving bracket ${i}`,
        quantity: 1,
        unitPrice: 2,
        amount: 2,
      })),
      subtotal: 1000,
      tax: 0,
      total: 1000,
      terms: null,
    },
  });
  expect(invoice.body.length).toBeLessThanOrEqual(
    NewRequest.shape.body.unwrap().maxLength ?? 0,
  );
  expect(invoice.body).toMatch(/\d+ more lines? left out\.?$/);
  expect(NewRequest.safeParse(invoice).success).toBe(true);
});

test("a document is classified, extracted, filed as a request and kept on it", async () => {
  const model = scripted([
    { type: "letter" },
    {
      data: {
        from: "Oakland Fire Department",
        to: "Fieldstone Supply",
        date: "2026-10-20",
        subject: "Annual fire inspection",
        summary:
          "The warehouse is due its annual inspection. A date in November is proposed.",
        fields: [{ name: "Reference", value: "FD-2026-1182" }],
        requested: [
          "Confirm 2026-11-12 at 9am",
          "Have the sprinkler certificate ready",
        ],
      },
      confidence: [
        { field: "from", score: 1 },
        { field: "date", score: 0.5 },
      ],
    },
  ]);
  const { request, document } = await ingest(
    {
      kind: "text",
      text: "Oakland Fire Department. Re: annual fire inspection…",
    },
    "fire-inspection.pdf",
    model,
  );
  expect(request).toMatchObject({
    title: "Annual fire inspection",
    team: "operations",
    status: "open",
  });
  expect(request.body).toContain("- Confirm 2026-11-12 at 9am");
  expect(document).toMatchObject({
    requestId: request.id,
    type: "letter",
    name: "fire-inspection.pdf",
    confidence: { from: 1, date: 0.5 },
  });
  expect(document.review).toEqual([
    "to",
    "date",
    "subject",
    "summary",
    "fields",
    "requested",
  ]);
  expect(await listDocuments(request.id)).toEqual([document]);
});
