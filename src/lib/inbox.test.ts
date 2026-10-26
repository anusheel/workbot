import { expect, test } from "vitest";
import {
  discard,
  getItem,
  listInbox,
  markFailed,
  receive,
  sourceOf,
  updateItem,
  waitingSince,
} from "./inbox";
import { query } from "./db";

test("a document is kept with its bytes, moved through the workflow's statuses, and listed newest first", async () => {
  const bytes = new Uint8Array([37, 80, 68, 70, 45]);
  const item = await receive("acme.pdf", "application/pdf", bytes);
  expect(item).toMatchObject({
    name: "acme.pdf",
    mediaType: "application/pdf",
    status: "received",
    type: null,
    review: [],
    requestId: null,
  });
  expect(await sourceOf(item.id)).toEqual({
    kind: "file",
    data: bytes,
    mediaType: "application/pdf",
  });
  await updateItem(item.id, {
    status: "awaiting_review",
    type: "invoice",
    data: { vendor: "Acme" },
    confidence: { vendor: 0.4 },
    review: ["vendor"],
  });
  expect(await getItem(item.id)).toMatchObject({
    status: "awaiting_review",
    type: "invoice",
    data: { vendor: "Acme" },
    review: ["vendor"],
  });
  const later = await receive("later.png", "image/png", new Uint8Array([137]));
  expect((await listInbox()).map((i) => i.id).slice(0, 2)).toEqual([
    later.id,
    item.id,
  ]);
  expect(
    await sourceOf("00000000-0000-0000-0000-000000000000"),
  ).toBeUndefined();
});

test("waitingSince finds the reviews nobody has answered for long enough", async () => {
  const fresh = await receive(
    "fresh.pdf",
    "application/pdf",
    new Uint8Array([1]),
  );
  const old = await receive("old.pdf", "application/pdf", new Uint8Array([2]));
  await updateItem(fresh.id, { status: "awaiting_review" });
  await updateItem(old.id, { status: "awaiting_review" });
  await query(
    `update inbox set updated_at = now() - interval '2 days' where id = $1`,
    [old.id],
  );
  expect((await waitingSince(24)).map((i) => i.id)).toEqual([old.id]);
});

test("discard removes the documents whose runs never started", async () => {
  const a = await receive("a.pdf", "application/pdf", new Uint8Array([1]));
  const b = await receive("b.pdf", "application/pdf", new Uint8Array([2]));
  await discard([a.id, b.id]);
  expect(await getItem(a.id)).toBeUndefined();
  expect(await getItem(b.id)).toBeUndefined();
});

test("a run that gave up marks its document failed, with the reason where the reviewer looks", async () => {
  const item = await receive(
    "broken.pdf",
    "application/pdf",
    new Uint8Array([3]),
  );
  await markFailed(item.id, "The model answered 500 three times.");
  expect(await getItem(item.id)).toMatchObject({
    status: "failed",
    review: ["The model answered 500 three times."],
  });
});

test("text and a page's address sent in come back as the sources they are, with who sent them", async () => {
  const encode = (text: string) => new TextEncoder().encode(text);
  const text = await receive(
    "text",
    "text/plain",
    encode("Please refund order 4411."),
    "intake",
  );
  const page = await receive(
    "https://fieldstone.example/po/7714",
    "text/uri-list",
    encode("https://fieldstone.example/po/7714"),
    "intake",
  );
  expect(text.owner).toBe("intake");
  expect(await sourceOf(text.id)).toEqual({
    kind: "text",
    text: "Please refund order 4411.",
  });
  expect(await sourceOf(page.id)).toEqual({
    kind: "url",
    url: "https://fieldstone.example/po/7714",
  });
});
