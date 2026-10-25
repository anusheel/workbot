import { expect, test } from "vitest";
import { getPolicy, listPolicies } from "./policies";

test("every policy has front matter and a body, and the list is sorted by title", async () => {
  const policies = await listPolicies();
  expect(policies.length).toBeGreaterThanOrEqual(8);
  expect(policies.map((p) => p.title)).toEqual(
    [...policies.map((p) => p.title)].sort((a, b) => a.localeCompare(b)),
  );
  for (const policy of policies) expect(policy.body).toMatch(/^[A-Z]/);
});

test("a policy is read by slug; unknown and unsafe slugs are undefined", async () => {
  expect(await getPolicy("refunds")).toMatchObject({
    title: "Customer refunds",
    owner: "Support",
  });
  expect(await getPolicy("not-a-policy")).toBeUndefined();
  expect(await getPolicy("../package")).toBeUndefined();
});
