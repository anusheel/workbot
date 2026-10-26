import { expect, test, vi } from "vitest";
import { uploadDocuments } from "@/app/admin/inbox/actions";
import { inngest } from "@/inngest/client";
import { maxFileBytes } from "@/lib/extract";
import { getItem, sourceOf } from "@/lib/inbox";
import { GET } from "./[id]/route";
import { DocumentStatus } from "./[id]/types";
import { POST } from "./route";
import { as, signIn } from "@/test/auth";

vi.mock("next/headers", async () => ({
  headers: async () => (await import("@/test/caller")).caller.headers,
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async () => ({ ids: [] })) },
}));

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

test("a document posted as text is kept under its sender, handed to the workflow, and followed at its address", async () => {
  const text =
    "From: dana@fieldstone.example\nSubject: Refund for order 4411\n\nPlease refund order 4411, it arrived damaged.";
  const response = await post({ text });
  expect(response.status).toBe(202);
  const { id, status, location } = await response.json();
  expect(status).toBe("received");
  expect(response.headers.get("location")).toBe(`/api/documents/${id}`);
  expect(location).toBe(`/api/documents/${id}`);
  const item = await getItem(id);
  expect(item?.owner).toEqual(expect.any(String));
  expect(await sourceOf(id)).toEqual({ kind: "text", text });
  expect(vi.mocked(inngest.send)).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "document/received",
      data: { id, owner: item?.owner },
    }),
  );

  const followed = await GET(
    new Request(`http://workbot${location}`, { headers: agent }),
    { params: Promise.resolve({ id }) },
  );
  expect(DocumentStatus.parse(await followed.json())).toEqual({
    id,
    status: "received",
    type: null,
    review: [],
    requestId: null,
  });
  const missing = await GET(
    new Request("http://workbot/api/documents/x", { headers: agent }),
    { params: Promise.resolve({ id: "x" }) },
  );
  expect(missing.status).toBe(404);
});

test("a short text, a bad or private address, an empty body and a file of the wrong type are rejected with the reason", async () => {
  vi.mocked(inngest.send).mockClear();
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
  expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
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

test("an empty file, a file over the limit, a broken zip and a malformed multipart body answer 400 before anything is queued", async () => {
  vi.mocked(inngest.send).mockClear();
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
  expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
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
