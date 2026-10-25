import { expect, test } from "vitest";
import { chatToolsFor } from "./chat";
import { toolsFor } from "./tools";
import { withTrace } from "./tracing";

const names = (role: Parameters<typeof toolsFor>[0]) =>
  toolsFor(role).map((t) => t.name);

test("the public gets the customer set, and each role what it reaches", () => {
  expect(names("public")).toEqual(
    expect.arrayContaining(["find", "cat", "calculator", "read_url"]),
  );
  expect(names("public")).not.toContain("find_contact");
  expect(names("viewer")).toContain("find_contact");
  expect(names("viewer")).not.toContain("save_note");
  expect(names("agent")).toContain("save_note");
});

test("a tool runs for a role that reaches it, and refuses one that does not, whatever it was offered", async () => {
  const chat = chatToolsFor("public");
  expect(
    await chat.calculator.execute!(
      { expression: "6 * 7" },
      { toolCallId: "t1", messages: [], context: undefined },
    ),
  ).toBe("42");
  const note = toolsFor("agent").find((t) => t.name === "save_note")!;
  await expect(
    withTrace({ caller: "v", name: "chat", role: "viewer" }, () =>
      note.run({ text: "Remember the dock code" }),
    ),
  ).rejects.toThrow(
    "save_note takes the agent role, and this caller is a viewer.",
  );
  await expect(note.run({ text: "x" })).rejects.toThrow("not signed in");
  expect(
    await withTrace({ caller: "a", name: "chat", role: "agent" }, () =>
      note.run({ text: "Remember the dock code" }),
    ),
  ).toMatch(/^Saved note /);
});
