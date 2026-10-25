export type Turn = { role: "caller" | "workbot"; text: string };
export type VoiceState = "idle" | "listening" | "thinking" | "speaking";
export type Voice = { state: VoiceState; turns: Turn[]; interim: string };

export type VoiceEvent =
  | { type: "start" }
  | { type: "stop" }
  /** Words from the caller: partial while they speak, final at a pause. */
  | { type: "heard"; text: string; final: boolean }
  | { type: "reply"; text: string }
  | { type: "spoken" };

/** The voice API rejects a turn longer than this (`src/lib/voice.ts`). */
const MAX_TURN = 2_000;

export const initial: Voice = { state: "idle", turns: [], interim: "" };

/**
 * The call as a state machine. The one rule that makes it feel like a call:
 * words heard while WorkBot speaks interrupt it, and it listens again.
 */
export function next(voice: Voice, event: VoiceEvent): Voice {
  switch (event.type) {
    case "start":
      return { ...voice, state: "listening", interim: "" };
    case "stop":
      return { ...voice, state: "idle", interim: "" };
    case "heard":
      if (voice.state === "idle" || voice.state === "thinking") return voice;
      if (!event.final)
        return { ...voice, state: "listening", interim: event.text };
      // The API rejects an empty turn, so silence must not start one.
      if (!event.text.trim())
        return { ...voice, state: "listening", interim: "" };
      return {
        state: "thinking",
        turns: [
          ...voice.turns,
          { role: "caller", text: event.text.slice(0, MAX_TURN) },
        ],
        interim: "",
      };
    case "reply":
      return voice.state === "thinking"
        ? {
            ...voice,
            state: "speaking",
            turns: [...voice.turns, { role: "workbot", text: event.text }],
          }
        : voice;
    case "spoken":
      return voice.state === "speaking"
        ? { ...voice, state: "listening" }
        : voice;
  }
}
