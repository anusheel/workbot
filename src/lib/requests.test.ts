import { expect, test } from "vitest";
import { NewRequest, createRequest, listRequests } from "./requests";

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
