import { expect, test } from "vitest";
import { GET, POST } from "./route";
import { RequestResponse } from "./types";

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

test("POST creates a request and GET lists it", async () => {
  const created = await post({
    title: "Badge printer out of labels",
    team: "operations",
  });
  expect(created.status).toBe(201);
  const request = RequestResponse.parse(await created.json());
  expect(request).toMatchObject({
    status: "open",
    priority: "normal",
    body: "",
  });
  const listed = RequestResponse.array().parse(await (await GET()).json());
  expect(listed[0]).toEqual(request);
});

test("POST rejects invalid input with the field errors", async () => {
  const response = await post({ title: "x", team: "legal" });
  expect(response.status).toBe(400);
  const { error } = await response.json();
  expect(Object.keys(error.fieldErrors).sort()).toEqual(["team", "title"]);
});

test("POST rejects a body that is not JSON", async () => {
  const response = await POST(
    new Request("http://workbot/api/requests", {
      method: "POST",
      body: "nope",
    }),
  );
  expect(response.status).toBe(400);
});
