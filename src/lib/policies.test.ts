import { expect, test } from "vitest";
import { getPolicy, listPolicies } from "./policies";

test("the policies are the knowledge base's policies section, sorted by title", async () => {
  const policies = await listPolicies();
  expect(policies.length).toBeGreaterThanOrEqual(8);
  expect(policies.map((p) => p.title)).toEqual(
    [...policies.map((p) => p.title)].sort((a, b) => a.localeCompare(b)),
  );
  expect(await getPolicy("refunds")).toMatchObject({
    title: "Customer refunds",
    owner: "Support",
  });
  expect(await getPolicy("not-a-policy")).toBeUndefined();
  expect(await getPolicy("../package")).toBeUndefined();
});
