import { expect, test } from "vitest";
import { health } from "./health";

test("reports the database as reachable", async () => {
  expect(await health()).toMatchObject({ status: "ok", database: "ok" });
});
