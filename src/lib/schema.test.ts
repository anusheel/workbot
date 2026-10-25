import { expect, test } from "vitest";
import { connect } from "./db";
import { schema } from "./schema";

// Every start applies the whole schema, so a second pass over a database the first one made must change nothing and fail nothing.
test("the schema applies twice over the same database", async () => {
  const owner = connect("memory://", { owner: true });
  for (const statement of schema) await owner.query(statement);
  for (const statement of schema) await owner.query(statement);
  const [traces] = await owner.query<{ columns: string[] }>(
    `select array_agg(column_name::text order by column_name) as columns from information_schema.columns where table_name = 'traces' and column_name in ('caller', 'tenant')`,
  );
  expect(traces.columns).toEqual(["caller", "tenant"]);
  await owner.close();
});
