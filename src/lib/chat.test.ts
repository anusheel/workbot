import { expect, test } from "vitest";
import { chatTools } from "./chat";

test("the web chat offers the customer tools and runs them", async () => {
  expect(Object.keys(chatTools)).toEqual(
    expect.arrayContaining(["find", "cat", "calculator", "read_url"]),
  );
  expect(Object.keys(chatTools)).not.toContain("save_note");
  expect(
    await chatTools.calculator.execute!(
      { expression: "6 * 7" },
      { toolCallId: "t1", messages: [], context: undefined },
    ),
  ).toBe("42");
});
