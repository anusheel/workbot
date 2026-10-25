import { expect, test } from "vitest";
import { listNotifications, notify } from "./notify";

test("a notification lands in the outbox, newest first", async () => {
  await notify("reviewers", "acme.pdf: check vendor", "/admin/inbox");
  // The order is by time; 2 rows in the same millisecond would tie.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await notify("finance", "Filed as a request");
  const [latest] = await listNotifications(5);
  expect(latest).toMatchObject({
    id: second.id,
    recipient: "finance",
    link: null,
  });
  expect(latest.createdAt).toBeInstanceOf(Date);
});
