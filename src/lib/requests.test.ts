import { expect, test } from "vitest";
import {
  NewRequest,
  RequestFilter,
  createRequest,
  getRequest,
  listRequests,
  requestSummary,
  updateRequest,
} from "./requests";

const request = (
  title: string,
  team: "operations" | "finance" | "support",
  priority: "low" | "normal" | "high" = "normal",
) => createRequest({ title, body: "", team, priority });

test("a new request is open, and the list is newest first", async () => {
  const first = await request("Replace the badge printer", "operations");
  const second = await request("Refund order 4411", "finance", "high");
  expect(first.status).toBe("open");
  expect(first.createdAt).toBeInstanceOf(Date);
  expect(await listRequests({}, 2)).toEqual([second, first]);
});

test("requests are filtered by team and status, and found by id", async () => {
  const wifi = await request("Office wifi is down", "support", "high");
  await updateRequest(wifi.id, { status: "in_progress" });
  expect(await getRequest(wifi.id)).toEqual({ ...wifi, status: "in_progress" });
  expect(
    await listRequests({ team: "support", status: "in_progress" }),
  ).toEqual([{ ...wifi, status: "in_progress" }]);
  expect(
    await listRequests({ team: "finance", status: "in_progress" }),
  ).toEqual([]);
  expect(await getRequest("missing")).toBeUndefined();
  expect(
    await getRequest("00000000-0000-0000-0000-000000000000"),
  ).toBeUndefined();
});

test("the schema trims, defaults and rejects", () => {
  const parsed = NewRequest.parse({
    title: "  Office wifi is down ",
    team: "support",
  });
  expect(parsed).toEqual({
    title: "Office wifi is down",
    body: "",
    team: "support",
    priority: "normal",
  });
  expect(NewRequest.safeParse({ title: "Hi", team: "support" }).success).toBe(
    false,
  );
  expect(RequestFilter.parse({ team: "legal", status: "open" })).toEqual({
    status: "open",
  });
});

test("the summary counts requests by status, team and priority", async () => {
  const summary = await requestSummary();
  expect(summary.total).toBe(3);
  expect(summary.byTeam).toEqual({ operations: 1, finance: 1, support: 1 });
  expect(summary.byStatus).toEqual({ open: 2, in_progress: 1, done: 0 });
  expect(summary.byPriority).toEqual({ low: 0, normal: 1, high: 2 });
  expect(summary.latest).toHaveLength(3);
});

test("updateRequest returns the updated request, or undefined for a bad or unknown id", async () => {
  const printer = await request("Fix the label printer", "operations");
  expect(await updateRequest(printer.id, { status: "done" })).toEqual({
    ...printer,
    status: "done",
  });
  expect(await updateRequest("nope", { status: "done" })).toBeUndefined();
  expect(
    await updateRequest(crypto.randomUUID(), { status: "done" }),
  ).toBeUndefined();
});
