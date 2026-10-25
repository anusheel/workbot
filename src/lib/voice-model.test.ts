import { expect, test } from "vitest";
import { type Voice, type VoiceEvent, initial, next } from "./voice-model";

const run = (events: VoiceEvent[], from: Voice = initial) =>
  events.reduce(next, from);

test("a turn: listen, hear a final transcript, think, speak the reply, listen again", () => {
  const thinking = run([
    { type: "start" },
    { type: "heard", text: "the badge", final: false },
    { type: "heard", text: "the badge printer is down", final: true },
  ]);
  expect(thinking).toEqual({
    state: "thinking",
    turns: [{ role: "caller", text: "the badge printer is down" }],
    interim: "",
  });
  const speaking = next(thinking, { type: "reply", text: "Which printer?" });
  expect(speaking.state).toBe("speaking");
  expect(speaking.turns.at(-1)).toEqual({
    role: "workbot",
    text: "Which printer?",
  });
  expect(next(speaking, { type: "spoken" }).state).toBe("listening");
});

test("words heard while WorkBot speaks interrupt it", () => {
  const speaking = run([
    { type: "start" },
    { type: "heard", text: "hello", final: true },
    {
      type: "reply",
      text: "Tell me what happened, in as much detail as you like.",
    },
  ]);
  const cutIn = next(speaking, {
    type: "heard",
    text: "actually",
    final: false,
  });
  expect(cutIn.state).toBe("listening");
  expect(cutIn.interim).toBe("actually");
  expect(next(cutIn, { type: "spoken" }).state).toBe("listening");
});

test("nothing is heard while idle or thinking, and stop keeps the transcript", () => {
  expect(next(initial, { type: "heard", text: "hi", final: true })).toBe(
    initial,
  );
  const thinking = run([
    { type: "start" },
    { type: "heard", text: "hi", final: true },
  ]);
  expect(next(thinking, { type: "heard", text: "and", final: true })).toBe(
    thinking,
  );
  const stopped = next(thinking, { type: "stop" });
  expect(stopped.state).toBe("idle");
  expect(stopped.turns).toHaveLength(1);
});

test("an empty or whitespace-only final result is not a turn", () => {
  const listening = run([{ type: "start" }]);
  for (const text of ["", "   \n"]) {
    expect(next(listening, { type: "heard", text, final: true })).toEqual(
      listening,
    );
  }
});

test("a final result over the API limit is cut to 2,000 characters", () => {
  const heard = run([
    { type: "start" },
    { type: "heard", text: "a".repeat(2_500), final: true },
  ]);
  expect(heard.turns[0].text).toHaveLength(2_000);
});
