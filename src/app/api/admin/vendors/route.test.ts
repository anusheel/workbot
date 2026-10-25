// Generated from content/entities/vendor.json by pnpm generate. Edit the description, not this file.
import { expect, test } from "vitest";
import { GET, POST } from "./route";
import { VendorResponse } from "./types";

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/admin/vendors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

test("creates a vendor from its required fields and lists it", async () => {
  const response = await post({ name: "Sample name" });
  expect(response.status).toBe(201);
  const created = VendorResponse.parse(await response.json());
  expect(created).toMatchObject({ name: "Sample name" });
  const listed = VendorResponse.array().parse(await (await GET()).json());
  expect(listed.map((row) => row.id)).toContain(created.id);
});

test("a vendor without name is refused with the field named", async () => {
  const response = await post({});
  expect(response.status).toBe(400);
  const { error } = await response.json();
  expect(Object.keys(error.fieldErrors)).toContain("name");
});
