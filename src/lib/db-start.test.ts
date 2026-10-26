import { expect, test } from "vitest";
import { config } from "./config";
import { query } from "./db";

test("a database that is down when the server starts is tried again on the next query", async () => {
  const database = config.database;
  config.database = "postgres://127.0.0.1:1/none";
  await expect(query("select 1")).rejects.toThrow();
  config.database = database;
  expect(await query("select 1 as one")).toEqual([{ one: 1 }]);
});
