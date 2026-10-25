import { expect, test } from "vitest";
import {
  NewRequest,
  RequestFilter,
  createRequest,
  getRequest,
  listRequests,
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
  expect((await listRequests()).slice(0, 2)).toEqual([second, first]);
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
