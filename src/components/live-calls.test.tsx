import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { LiveCalls, linesOf } from "./live-calls";

test("waits for calls on the server it was given", () => {
  const html = renderToStaticMarkup(
    <LiveCalls url="ws://localhost:3302" assistant="WorkBot" canSpeak />,
  );
  expect(html).toContain("Connecting on ws://localhost:3302");
  expect(html).toContain("No calls yet.");
});

test("a turn is the caller's line and the assistant's; a note is the team's", () => {
  expect(
    linesOf({
      call: "c",
      from: "caller",
      event: { type: "turn", heard: "Is the yard open?", reply: "Until 6." },
    }),
  ).toEqual([
    { who: "caller", text: "Is the yard open?" },
    { who: "assistant", text: "Until 6." },
  ]);
  expect(
    linesOf({ call: "c", from: "staff", event: { type: "note", text: "Hi" } }),
  ).toEqual([{ who: "team", text: "Hi" }]);
  expect(
    linesOf({ call: "c", from: "caller", event: { type: "end" } }),
  ).toEqual([]);
});
