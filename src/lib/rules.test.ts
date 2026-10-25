import { expect, test } from "vitest";
import { applyRules, companyFromEmail, normalizePhone, rules } from "./rules";

test("the rule table parses, routes only to the customer's teams, and keeps its order", () => {
  expect(rules.map((r) => r.id)).toEqual([
    "phone-e164",
    "company-from-domain",
    "route-finance",
    "route-support",
    "route-operations",
    "large-invoice",
  ]);
});

test.each([
  ["(503) 555-0142", "+15035550142"],
  ["1-503-555-0142", "+15035550142"],
  ["+44 20 7946 0958", "+442079460958"],
  ["x204", "x204"],
])("a phone as written, %s, becomes %s", (raw, normalized) => {
  expect(normalizePhone(raw)).toBe(normalized);
});

test("a company comes from the email's domain, hyphens as spaces", () => {
  expect(companyFromEmail("dana.whitfield@brightline-retail.example")).toBe(
    "Brightline Retail",
  );
  expect(companyFromEmail("nobody")).toBeNull();
});

test("a contact is normalized and enriched, and every change is written down", () => {
  const { record, applied } = applyRules("contact", {
    name: "Dana Whitfield",
    email: "dana.whitfield@brightline-retail.example",
    phone: "(503) 555-0142",
    company: null,
  });
  expect(record).toMatchObject({
    phone: "+15035550142",
    company: "Brightline Retail",
  });
  expect(applied).toEqual([
    {
      rule: "phone-e164",
      field: "phone",
      from: "(503) 555-0142",
      to: "+15035550142",
    },
    {
      rule: "company-from-domain",
      field: "company",
      from: null,
      to: "Brightline Retail",
    },
  ]);
});

test("a ticket is routed by the first rule whose words match, and a routed one is left alone", () => {
  const route = (text: string, team: string | null = null) =>
    applyRules("ticket", { team, text }).record.team;
  expect(route("Credit memo for the van 3 repair")).toBe("finance");
  expect(route("Customer complaint about a late delivery")).toBe("support");
  expect(route("Loading dock light out")).toBe("operations");
  expect(route("Quarterly offsite agenda")).toBeNull();
  expect(route("Credit memo", "operations")).toBe("operations");
});

test("an invoice over the threshold is flagged, one under it is not", () => {
  const large = applyRules("invoice", { total: 7200 });
  expect(large.record.flags).toEqual([
    "Total over $5,000: the finance lead approves",
  ]);
  expect(large.applied).toHaveLength(1);
  expect(applyRules("invoice", { total: 480 }).applied).toEqual([]);
});
