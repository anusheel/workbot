import { expect, test } from "vitest";
import { cacheSummary, cached } from "./cache";
import { query } from "./db";

test("a read is fetched once, served while fresh, and served stale while a fetch replaces it", async () => {
  let fetches = 0;
  const read = () => cached("page:x", 60_000, async () => `text ${++fetches}`);
  expect(await read()).toMatchObject({ value: "text 1", outcome: "miss" });
  expect(await read()).toMatchObject({ value: "text 1", outcome: "hit" });

  await query(
    `update cache set fetched_at = now() - interval '2 minutes' where key = 'page:x'`,
  );
  const stale = await read();
  expect(stale).toMatchObject({ value: "text 1", outcome: "stale" });
  await stale.refresh;
  expect(await read()).toMatchObject({ value: "text 2", outcome: "hit" });
  expect(fetches).toBe(2);
  expect(await cacheSummary()).toEqual({
    reads: 4,
    hitRate: 0.5,
    stale: 1,
    medianAgeS: 0,
  });
});
