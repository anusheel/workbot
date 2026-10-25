import { expect, test } from "vitest";
import {
  NewRequest,
  createRequest,
  getRequest,
  listRequests,
  updateRequest,
} from "./requests";

test("a new request is open, newest first", async () => {
  const first = await createRequest({
    title: "Replace the badge printer",
    body: "",
    team: "operations",
    priority: "normal",
  });
  const second = await createRequest({
    title: "Refund order 4411",
    body: "",
    team: "finance",
    priority: "high",
  });
  expect(first.status).toBe("open");
  expect((await listRequests()).slice(0, 2)).toEqual([second, first]);
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
  expect(
    NewRequest.safeParse({ title: "A valid title", team: "legal" }).success,
  ).toBe(false);
});

test("a request is found by id, or undefined", async () => {
  const request = await createRequest({
    title: "Replace the badge printer",
    body: "",
    team: "operations",
    priority: "normal",
  });
  expect(await getRequest(request.id)).toBe(request);
  expect(await getRequest("missing")).toBeUndefined();
});

test("a request's status can change; an unknown id changes nothing", async () => {
  const request = await createRequest({
    title: "Replace the badge printer",
    body: "",
    team: "operations",
    priority: "normal",
  });
  expect(await updateRequest(request.id, { status: "done" })).toMatchObject({
    status: "done",
  });
  expect(await updateRequest("missing", { status: "done" })).toBeUndefined();
});
