import { InngestTestEngine, mockCtx } from "@inngest/test";
import { MockLanguageModelV4 } from "ai/test";
import { NonRetriableError } from "inngest";
import { expect, test, vi } from "vitest";
import { listDocuments } from "@/lib/documents";
import { getItem, receive } from "@/lib/inbox";
import { listNotifications } from "@/lib/notify";
import { getRequest } from "@/lib/requests";
import { documentApproval } from "./document-approval";

// The model behind the real classify and extract steps answers from a script.
const replies: string[] = [];
vi.mock("@/lib/chat", () => ({
  chatModel: () =>
    new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: replies.shift() ?? "" }],
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
    }),
}));

// The model's steps are mocked by id; everything after them runs for real,
// against the embedded database.
const invoice = {
  vendor: "Acme Supplies Co.",
  number: "INV-4471",
  date: "2026-10-01",
  due: "2026-10-31",
  currency: "USD",
  lines: [
    { description: "Shelving", quantity: 4, unitPrice: 310, amount: 1240 },
  ],
  subtotal: 1240,
  tax: 0,
  total: 1240,
  terms: "net 30",
};
type Answer = {
  decision: "approved" | "rejected";
  data?: Record<string, unknown>;
} | null;

/**
 * The function under test, with the model's steps mocked by id. A reviewer's
 * answer, when given, stands in for the waitForEvent step: the engine cannot
 * resolve that step's event itself.
 */
const engine = (id: string, answer?: Answer) =>
  new InngestTestEngine({
    function: documentApproval,
    events: [{ name: "document/received", data: { id } }],
    ...(answer === undefined
      ? {}
      : {
          transformCtx: (raw) => {
            const ctx = mockCtx(raw);
            ctx.step.waitForEvent = vi.fn(
              async () =>
                answer && {
                  name: "document/reviewed",
                  data: { id, ...answer },
                },
            ) as typeof ctx.step.waitForEvent;
            return ctx;
          },
        }),
  });

test("a confident extraction is filed without a reviewer, and the uploader is told", async () => {
  const item = await receive(
    "acme.pdf",
    "application/pdf",
    new Uint8Array([37]),
  );
  const { result, ctx } = await engine(item.id).execute({
    steps: [
      { id: "classify", handler: () => "invoice" },
      {
        id: "extract",
        handler: () => ({
          data: invoice,
          confidence: { total: 1 },
          review: [],
          attempts: 1,
        }),
      },
    ],
  });
  expect(result).toMatchObject({ status: "stored" });
  const stored = await getItem(item.id);
  expect(stored).toMatchObject({ status: "stored", data: invoice });
  const request = await getRequest(stored!.requestId!);
  expect(request).toMatchObject({
    title: "Pay Acme Supplies Co. invoice INV-4471, USD 1,240.00",
    team: "finance",
  });
  expect(await listDocuments(request!.id)).toHaveLength(1);
  expect(ctx.step.waitForEvent).not.toHaveBeenCalled();
  expect((await listNotifications(1))[0]).toMatchObject({
    recipient: "uploader",
    link: `/requests/${request!.id}`,
  });
});

test("a doubtful field pauses the run for a reviewer, whose corrections are what gets filed", async () => {
  const item = await receive("blurry.png", "image/png", new Uint8Array([137]));
  const extraction = {
    data: { ...invoice, total: 1204 },
    confidence: { total: 0.3 },
    review: ["total"],
    attempts: 1,
  };
  const paused = await engine(item.id).executeStep("review", {
    steps: [
      { id: "classify", handler: () => "invoice" },
      { id: "extract", handler: () => extraction },
    ],
  });
  expect(paused.ctx.step.waitForEvent).toHaveBeenCalledWith("review", {
    event: expect.objectContaining({ name: "document/reviewed" }),
    match: "data.id",
    timeout: "3d",
  });
  // The mocked extract step wrote nothing; the real ask-for-review step did.
  expect((await getItem(item.id))?.status).toBe("awaiting_review");
  expect((await listNotifications(1))[0]).toMatchObject({
    recipient: "reviewers",
    message: "blurry.png: check total",
  });

  const { result } = await engine(item.id, {
    decision: "approved",
    data: { total: 1240 },
  }).execute({
    steps: [
      { id: "classify", handler: () => "invoice" },
      { id: "extract", handler: () => extraction },
    ],
  });
  expect(result).toMatchObject({ status: "stored" });
  expect((await getItem(item.id))?.data).toMatchObject({ total: 1240 });
});

test("a rejection and a timeout end the run without a request", async () => {
  const item = await receive(
    "spam.pdf",
    "application/pdf",
    new Uint8Array([37]),
  );
  const doubtful = {
    id: "extract",
    handler: () => ({
      data: invoice,
      confidence: {},
      review: ["vendor"],
      attempts: 1,
    }),
  };
  const rejected = await engine(item.id, { decision: "rejected" }).execute({
    steps: [{ id: "classify", handler: () => "invoice" }, doubtful],
  });
  expect(rejected.result).toEqual({ status: "rejected" });
  expect((await getItem(item.id))?.status).toBe("rejected");

  const other = await receive(
    "late.pdf",
    "application/pdf",
    new Uint8Array([37]),
  );
  const expired = await engine(other.id, null).execute({
    steps: [{ id: "classify", handler: () => "invoice" }, doubtful],
  });
  expect(expired.result).toEqual({ status: "expired" });
  expect((await getItem(other.id))?.status).toBe("expired");
  expect((await getItem(other.id))?.requestId).toBeNull();
});

test("the real classify and extract steps write what they found to the inbox row", async () => {
  const item = await receive(
    "acme.pdf",
    "application/pdf",
    new Uint8Array([37]),
  );
  replies.push(
    JSON.stringify({ type: "invoice" }),
    JSON.stringify({
      data: invoice,
      confidence: [
        { field: "vendor", score: 1 },
        { field: "total", score: 0.4 },
      ],
    }),
  );
  await engine(item.id).executeStep("review");
  expect(await getItem(item.id)).toMatchObject({
    type: "invoice",
    status: "awaiting_review",
    data: invoice,
    confidence: { vendor: 1, total: 0.4 },
  });
  expect((await getItem(item.id))?.review).toContain("total");
});

test("corrections that break the schema file nothing and fail without a retry", async () => {
  const item = await receive(
    "bad.pdf",
    "application/pdf",
    new Uint8Array([37]),
  );
  const { result, error } = await engine(item.id, {
    decision: "approved",
    data: { total: "twelve" },
  }).execute({
    steps: [
      { id: "classify", handler: () => "invoice" },
      {
        id: "extract",
        handler: () => ({
          data: invoice,
          confidence: {},
          review: ["total"],
          attempts: 1,
        }),
      },
    ],
  });
  expect(result).not.toMatchObject({ status: "stored" });
  // The engine hands the error back serialized, so it is matched by name.
  expect(error).toMatchObject({ name: NonRetriableError.name });
  const row = await getItem(item.id);
  expect(row?.requestId).toBeNull();
  expect(row?.status).not.toBe("stored");
  expect(row?.review.join(" ")).toContain("total");
});
