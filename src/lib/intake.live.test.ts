import { expect, test } from "vitest";
import { chatModel } from "./chat";
import { intake } from "./intake";

test("a message becomes a triaged request", async () => {
  const request = await intake(
    "Hi there, the Zebra printer at reception has run out of 4x6 labels and visitors can't get badges. Thanks, Dana",
    chatModel("small"),
  );
  expect(request.team).toBe("operations");
  expect(["high", "normal"]).toContain(request.priority);
  expect(request.title.toLowerCase()).toMatch(/label|printer|badge/);
});
