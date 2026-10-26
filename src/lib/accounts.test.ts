import { expect, test } from "vitest";
import { Account, score } from "./accounts";

const yard = Account.parse({
  name: "Valley Block and Supply",
  website: "https://valleyblock.example",
  state: "CA",
  category: "masonry",
  locations: 2,
  employees: "50-100",
  delivers: true,
  contractorOrdering: true,
  departments: null,
  evidence: ["https://valleyblock.example/delivery"],
});

test("an account scores the criteria its evidence meets, and nothing for what is unknown", () => {
  expect(score(yard)).toEqual({
    score: 8,
    reasons: [
      "delivers to job sites",
      "takes contractors' orders by phone, text or email",
      "more than one location",
    ],
  });
});
