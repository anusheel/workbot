// Generated from content/entities/location.json by pnpm generate. Edit the description, not this file.
import { expect, test } from "vitest";
import { GET, POST } from "./route";
import { LocationResponse } from "./types";

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/locations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

test("creates a location from its required fields and lists it", async () => {
  const response = await post({
    name: "Sample name",
    address: "Sample address",
  });
  expect(response.status).toBe(201);
  const created = LocationResponse.parse(await response.json());
  expect(created).toMatchObject({
    name: "Sample name",
    address: "Sample address",
  });
  const listed = LocationResponse.array().parse(await (await GET()).json());
  expect(listed.map((row) => row.id)).toContain(created.id);
});

test("a location without name is refused with the field named", async () => {
  const response = await post({ address: "Sample address" });
  expect(response.status).toBe(400);
  const { error } = await response.json();
  expect(Object.keys(error.fieldErrors)).toContain("name");
});
