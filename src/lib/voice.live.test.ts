import { expect, test } from "vitest";
import { chatModel } from "./chat";
import { type Turn, voiceTurn } from "./voice";

test("a caller's report becomes a filed request on the small model", async () => {
  const turns: Turn[] = [
    {
      role: "caller",
      text: "Hi, this is Dana from the receiving dock. The badge printer in the warehouse stopped working this morning.",
    },
  ];
  const first = await voiceTurn(turns, chatModel("small"));
  expect(first.say.length).toBeLessThan(300);
  expect(first.say).not.toMatch(/[*#\n-]/);
  turns.push(
    { role: "workbot", text: first.say },
    {
      role: "caller",
      text: "Six new starters are waiting for badges, so it is urgent. Nobody else is affected, and it is the only printer down there.",
    },
  );
  let turn = await voiceTurn(turns, chatModel("small"));
  if (!turn.request) {
    turns.push(
      { role: "workbot", text: turn.say },
      { role: "caller", text: "That is everything I know. Please file it." },
    );
    turn = await voiceTurn(turns, chatModel("small"));
  }
  expect(turn.request).toMatchObject({ status: "open", priority: "high" });
  expect(turn.request?.title).toMatch(/badge|printer/i);
  expect(turn.say).toContain(`as "${turn.request?.title}"`);
}, 120_000);
