import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ConversationList } from "./conversation-list";

test("lists conversations and marks the active one", () => {
  const html = renderToStaticMarkup(
    <ConversationList
      conversations={[
        { id: "a", title: "Meal limit", updatedAt: 2, messages: [] },
        { id: "b", title: "Refund rules", updatedAt: 1, messages: [] },
      ]}
      activeId="b"
      onSelect={() => {}}
      onNew={() => {}}
    />,
  );
  expect(html).toContain(">New chat</button>");
  expect(html).toContain('aria-current="true"');
  expect(html.indexOf("Meal limit")).toBeLessThan(html.indexOf("Refund rules"));
});
