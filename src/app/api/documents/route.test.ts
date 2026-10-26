import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { uploadDocuments } from "@/app/admin/inbox/actions";
import { maxFileBytes } from "@/lib/extract";
import { POST } from "./route";
import { as, signIn } from "@/test/auth";

vi.mock("next/headers", async () => ({
  headers: async () => (await import("@/test/caller")).caller.headers,
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/inbox", () => ({ receive: vi.fn(), discard: vi.fn() }));
const generated = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/routing", () => {
  const replies = [
    { type: "email" },
    {
      data: {
        from: "dana@fieldstone.example",
        to: ["support@fieldstone.example"],
        subject: "Refund for order 4411",
        intent: "request",
        actions: ["Refund order 4411"],
        urgency: "medium",
      },
      confidence: [{ field: "from", score: 1 }],
    },
  ];
  return {
    modelFor: () =>
      new MockLanguageModelV4({
        doGenerate: async () => ({
          ...(generated.calls++, {}),
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
      }),
  };
});

const agent = await as("agent");
await signIn("agent");

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json", ...agent },
      body: JSON.stringify(body),
    }),
  );

test("a document posted as text becomes a request with its record attached", async () => {
  const response = await post({
    text: "From: dana@fieldstone.example\nTo: support@fieldstone.example\nSubject: Refund for order 4411\n\nPlease refund order 4411, it arrived damaged.",
  });
  expect(response.status).toBe(201);
  const { request, document } = await response.json();
  expect(request).toMatchObject({
    title: "Refund for order 4411",
    team: "operations",
    status: "open",
  });
  expect(document).toMatchObject({ type: "email", name: "text" });
});

test("a short text, a bad or private address, an empty body and a file of the wrong type are rejected with the reason", async () => {
  expect((await post({ text: "hi" })).status).toBe(400);
  expect((await post({ url: "not a url" })).status).toBe(400);
  const local = await post({ url: "http://localhost:3000/admin" });
  expect(local.status).toBe(400);
  expect(JSON.stringify(await local.json())).toContain(
    "public http or https address",
  );
  expect((await post({})).status).toBe(400);
  const form = new FormData();
  form.set(
    "document",
    new File(["plain"], "notes.txt", { type: "text/plain" }),
  );
  const upload = await POST(
    new Request("http://workbot/api/documents", {
      method: "POST",
      headers: agent,
      body: form,
    }),
  );
  expect(upload.status).toBe(400);
  expect(JSON.stringify(await upload.json())).toContain(
    "a PDF, a Word document or an image",
  );
});

const upload = (file: File) => {
  const form = new FormData();
  form.set("document", file);
  return POST(
    new Request("http://workbot/api/documents", {
      method: "POST",
      headers: agent,
      body: form,
    }),
  );
};

test("an empty file, a file over the limit, a broken zip and a malformed multipart body answer 400 before any model call", async () => {
  generated.calls = 0;
  const empty = await upload(
    new File([], "empty.pdf", { type: "application/pdf" }),
  );
  expect(empty.status).toBe(400);
  const big = await upload(
    new File([new Uint8Array(maxFileBytes + 1)], "big.pdf", {
      type: "application/pdf",
    }),
  );
  expect(big.status).toBe(400);
  expect(JSON.stringify(await big.json())).toContain("10 MB");
  const broken = await upload(
    new File(["PK but no archive"], "contract.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  );
  expect(broken.status).toBe(400);
  const garbage = await POST(
    new Request("http://workbot/api/documents", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", ...agent },
      body: "garbage",
    }),
  );
  expect(garbage.status).toBe(400);
  expect(generated.calls).toBe(0);
});

test("the inbox upload refuses an oversized file the same way", async () => {
  const form = new FormData();
  form.append(
    "documents",
    new File([new Uint8Array(maxFileBytes + 1)], "big.pdf", {
      type: "application/pdf",
    }),
  );
  await expect(uploadDocuments(form)).rejects.toThrow("10 MB");
});
