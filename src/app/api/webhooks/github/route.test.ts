import { createHmac } from "node:crypto";
import { expect, test, vi } from "vitest";
import { query } from "@/lib/db";
import { findTickets } from "@/lib/unified";
import { POST } from "./route";

vi.hoisted(() => {
  process.env.GITHUB_REPO = "acme/helpdesk";
  process.env.GITHUB_WEBHOOK_SECRET = "s3cret";
});

const issue = (number: number, title: string) => ({
  number,
  title,
  body: null,
  state: "open",
  user: { login: "sam" },
  assignees: [],
  labels: [{ name: "fleet" }],
  html_url: `https://github.com/acme/helpdesk/issues/${number}`,
  updated_at: new Date(Date.now() - 4000).toISOString(),
});
const repository = { full_name: "acme/helpdesk" };

const deliver = (
  payload: unknown,
  { event = "issues", secret = "s3cret" } = {},
) => {
  const body = JSON.stringify(payload);
  return POST(
    new Request("http://workbot/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": event,
        "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
      },
      body,
    }),
  );
};

test("a signed issues delivery replaces the ticket's row, routed, and is logged with its lag", async () => {
  const response = await deliver({
    action: "opened",
    issue: issue(12, "Van 3 brake light"),
    repository,
  });
  expect(response.status).toBe(204);
  expect(await findTickets("brake")).toMatchObject([
    { id: "github#12", team: "operations", labels: ["fleet"] },
  ]);
  const [logged] = await query<{ path: string; lag_s: number }>(
    `select path, lag_s from sync_log where key = '12'`,
  );
  expect(logged.path).toBe("webhook");
  expect(logged.lag_s).toBeGreaterThanOrEqual(4);
});

test("a delivery with the wrong signature is refused", async () => {
  const response = await deliver(
    { action: "opened", issue: issue(13, "Forklift charger"), repository },
    { secret: "wrong" },
  );
  expect(response.status).toBe(401);
  expect(await findTickets("forklift")).toEqual([]);
});

test("another event or another repository is acknowledged and ignored, and a malformed one is a 400", async () => {
  const other = {
    action: "created",
    issue: issue(14, "Pallet jack"),
    repository,
  };
  expect((await deliver(other, { event: "issue_comment" })).status).toBe(204);
  expect(
    (await deliver({ ...other, repository: { full_name: "acme/other" } }))
      .status,
  ).toBe(204);
  expect(await findTickets("pallet")).toEqual([]);
  expect((await deliver({ action: "opened" })).status).toBe(400);
  const notJson = await POST(
    new Request("http://workbot/api/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": `sha256=${createHmac("sha256", "s3cret").update("{").digest("hex")}`,
      },
      body: "{",
    }),
  );
  expect(notJson.status).toBe(400);
});
