import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { InboxItem } from "@/lib/inbox";
import { InboxStatus } from "./inbox-status";

const item = (over: Partial<InboxItem>): InboxItem => ({
  id: "i1",
  name: "invoice.pdf",
  mediaType: "application/pdf",
  status: "received",
  type: null,
  data: null,
  confidence: null,
  review: [],
  requestId: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

const review = async () => {};

test("shows a failed item's reason next to the Failed badge", () => {
  const html = renderToStaticMarkup(
    <InboxStatus
      item={item({ status: "failed", review: ["Model timed out"] })}
      review={review}
    />,
  );
  expect(html).toMatch(/Failed[\s\S]*Model timed out/);
});

test("names the approve and reject buttons after the document", () => {
  const html = renderToStaticMarkup(
    <InboxStatus
      item={item({ status: "awaiting_review", review: ["total"] })}
      review={review}
    />,
  );
  expect(html).toContain('aria-label="Approve invoice.pdf"');
  expect(html).toContain('aria-label="Reject invoice.pdf"');
});

test("labels each status with the step in progress", () => {
  const label = (status: InboxItem["status"]) =>
    renderToStaticMarkup(
      <InboxStatus item={item({ status })} review={review} />,
    );
  expect(label("received")).toContain("Extracting");
  expect(label("extracted")).toContain("Checking");
});
