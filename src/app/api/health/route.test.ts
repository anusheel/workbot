import { expect, test } from "vitest";
import { GET } from "./route";

test("reports the database as reachable", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok", database: "ok" });
});
