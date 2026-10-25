import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { MemoryList } from "./memory-list";

const noop = async () => {};

test("groups memories by kind with a way to forget each, and says when there are none", () => {
  expect(
    renderToStaticMarkup(
      <MemoryList memories={[]} onForget={noop} onForgetAll={noop} />,
    ),
  ).toContain("Nothing yet");
  const html = renderToStaticMarkup(
    <MemoryList
      memories={[
        {
          id: "1",
          kind: "case",
          text: "The person is handling the badge printer request.",
          createdAt: new Date(),
        },
        {
          id: "2",
          kind: "preference",
          text: "The person wants short answers.",
          createdAt: new Date(),
        },
      ]}
      onForget={noop}
      onForgetAll={noop}
    />,
  );
  expect(html.indexOf("Preferences")).toBeLessThan(html.indexOf("Cases"));
  expect(html).not.toContain("People, teams and systems");
  expect(html.match(/>Forget</g)).toHaveLength(2);
  expect(html).toContain("Forget everything");
});
