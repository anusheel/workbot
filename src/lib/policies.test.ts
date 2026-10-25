import { expect, test } from "vitest";
import { getPolicy, listPolicies, searchPolicies } from "./policies";

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

test("search ranks the policies that mention the question's words and quotes the lines", async () => {
  const hits = await searchPolicies(
    "How much can an agent refund on a damaged order?",
  );
  expect(hits[0].slug).toBe("refunds");
  expect(hits[0].snippets.some((line) => line.includes("$200"))).toBe(true);
  expect(hits.length).toBeLessThanOrEqual(3);
  expect(await searchPolicies("zzzz")).toEqual([]);
});
