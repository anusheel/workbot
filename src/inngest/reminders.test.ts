import { InngestTestEngine } from "@inngest/test";
import { expect, test } from "vitest";
import { query } from "@/lib/db";
import { receive, updateItem } from "@/lib/inbox";
import { listNotifications } from "@/lib/notify";
import { createRequest } from "@/lib/requests";
import { reminders } from "./reminders";

test("the morning run nudges the reviews left for a day and checks in on requests open for a week", async () => {
  const waiting = await receive(
    "old.pdf",
    "application/pdf",
    new Uint8Array([37]),
  );
  await updateItem(waiting.id, {
    status: "awaiting_review",
    review: ["total"],
  });
  await query(
    `update inbox set updated_at = now() - interval '2 days' where id = $1`,
    [waiting.id],
  );
  const stale = await createRequest({
    title: "Replace the dock lights",
    body: "",
    team: "operations",
    priority: "normal",
  });
  await query(
    `update requests set created_at = now() - interval '9 days' where id = $1`,
    [stale.id],
  );
  await createRequest({
    title: "Fresh",
    body: "",
    team: "support",
    priority: "low",
  });

  const t = new InngestTestEngine({ function: reminders });
  const { result, ctx } = await t.execute();
  expect(result).toEqual({ reminded: 1, checkIns: 1 });
  expect(ctx.step.run).toHaveBeenCalledWith(
    `remind-${waiting.id}`,
    expect.any(Function),
  );
  expect(ctx.step.run).toHaveBeenCalledWith(
    `check-in-${stale.id}`,
    expect.any(Function),
  );
  const sent = await listNotifications(5);
  expect(sent.map((n) => n.recipient)).toEqual(
    expect.arrayContaining(["reviewers", "operations"]),
  );
  expect(sent.find((n) => n.recipient === "operations")?.message).toBe(
    "Still open after a week: Replace the dock lights.",
  );
});
