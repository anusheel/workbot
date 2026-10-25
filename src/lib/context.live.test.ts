import type { UIMessage } from "ai";
import { expect, test } from "vitest";
import { chatModel } from "./chat";
import { summarize } from "./context";

const message = (
  id: string,
  role: "user" | "assistant",
  text: string,
): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text }],
});

test("the small model summarizes dropped messages into a short account", async () => {
  const summary = await summarize(chatModel("small"), [
    message(
      "1",
      "user",
      "The badge printer at reception has been out of labels since Monday.",
    ),
    message(
      "2",
      "assistant",
      "Filed as an operations request; the stationery cupboard has labels, and the printer reports a feed error.",
    ),
    message(
      "3",
      "user",
      "Please mark it high priority; visitors cannot get badges.",
    ),
  ]);
  expect(summary.split(/\s+/).length).toBeLessThan(160);
  expect(summary).toMatch(/printer|label/i);
});
