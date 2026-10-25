import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/chat", () => {
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
    chatModel: () =>
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
      }),
  };
});

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    new Request("http://workbot/api/documents", { method: "POST", body: form }),
  );
  expect(upload.status).toBe(400);
  expect(JSON.stringify(await upload.json())).toContain("application/pdf");
});
