import { expect, test } from "vitest";
import { as } from "@/test/auth";
import { GET, POST } from "./route";
import { RequestResponse } from "./types";

const url = "http://workbot/api/requests";
const agent = await as("agent");
const post = (body: unknown, headers: Record<string, string> = agent) =>
  POST(
    new Request(url, { method: "POST", headers, body: JSON.stringify(body) }),
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
  const listed = RequestResponse.array().parse(
    await (await GET(new Request(url, { headers: agent }))).json(),
  );
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
    new Request(url, { method: "POST", headers: agent, body: "nope" }),
  );
  expect(response.status).toBe(400);
});

test("no key is a 401, a viewer may list but not file, and a revoked or made-up key is no one", async () => {
  const body = { title: "Badge printer out of labels", team: "operations" };
  expect((await post(body, {})).status).toBe(401);
  expect(
    (await post(body, { authorization: "Bearer wb_made-up" })).status,
  ).toBe(401);
  const viewer = await as("viewer");
  expect((await post(body, viewer)).status).toBe(403);
  expect((await GET(new Request(url, { headers: viewer }))).status).toBe(200);
  expect((await GET(new Request(url))).status).toBe(401);
});
