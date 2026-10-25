import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  askRecording,
  clock,
  describeFrames,
  duration,
  extractFrames,
  summarize,
} from "./video";

let dir: string;
let video: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "workbot-video-"));
  video = join(dir, "test.mp4");
  // 5 seconds of ffmpeg's test pattern, small and fast to make.
  await promisify(execFile)("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=5:size=160x120:rate=5",
    "-pix_fmt",
    "yuv420p",
    video,
  ]);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

/** A model that answers from a script and keeps the prompts it was sent. */
function scripted(replies: string[]) {
  const prompts: { role: string; content: unknown }[][] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        content: [{ type: "text", text: replies.shift() ?? "" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

test("clock writes seconds as m:ss", () => {
  expect(clock(0)).toBe("0:00");
  expect(clock(75)).toBe("1:15");
});

test("frames come out of the recording one every 2 seconds, as PNGs with their time", async () => {
  expect(await duration(video)).toBeCloseTo(5, 1);
  const frames = await extractFrames(video);
  expect(frames.map((f) => f.at)).toEqual([0, 2, 4]);
  for (const frame of frames) {
    expect([...frame.png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(frame.png.length).toBeGreaterThan(500);
  }
  await expect(extractFrames(join(dir, "missing.mp4"))).rejects.toThrow();
});

test("a wide recording's frames are scaled down to 1024 pixels across", async () => {
  const wide = join(dir, "wide.mp4");
  await promisify(execFile)("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=1:size=1600x900:rate=5",
    "-pix_fmt",
    "yuv420p",
    wide,
  ]);
  const [frame] = await extractFrames(wide);
  // The PNG header carries the width as a big-endian integer at byte 16.
  const width = new DataView(frame.png.buffer, frame.png.byteOffset).getUint32(
    16,
  );
  expect(width).toBe(1024);
});

test("frames are described a batch at a time, with the image beside each time", async () => {
  const frames = await extractFrames(video, { every: 1 });
  const { model, prompts } = scripted([
    JSON.stringify({
      scenes: [
        { at: 0, text: "A colour test pattern with a counter at 0." },
        { at: 1, text: "The counter reads 1." },
        { at: 2, text: "The counter reads 2." },
      ],
    }),
    JSON.stringify({
      scenes: [
        { at: 3, text: "The counter reads 3." },
        { at: 4, text: "The counter reads 4." },
      ],
    }),
  ]);
  const scenes = await describeFrames(frames, model, { batch: 3 });
  expect(scenes).toHaveLength(5);
  expect(scenes[4]).toEqual({ at: 4, text: "The counter reads 4." });
  expect(prompts).toHaveLength(2);
  // The last message of the first call: the user turn, after the instructions.
  const parts = prompts[0].at(-1)?.content as { type: string }[];
  expect(parts.filter((p) => p.type === "file")).toHaveLength(3);
  expect(parts[0]).toMatchObject({
    type: "text",
    text: "Frame at 0:00 (0 seconds):",
  });
});

test("the timeline and an answer come from the frame notes", async () => {
  const scenes = [
    { at: 0, text: "A person walks to the receiving dock." },
    { at: 2, text: "They sign a delivery note." },
  ];
  const { model, prompts } = scripted([
    "0:00-0:02: A person walks to the receiving dock and signs a delivery note.",
    "They signed a delivery note, seen at 0:02.",
  ]);
  expect(await summarize(scenes, model)).toBe(
    "0:00-0:02: A person walks to the receiving dock and signs a delivery note.",
  );
  expect(await askRecording(scenes, "What did they sign?", model)).toBe(
    "They signed a delivery note, seen at 0:02.",
  );
  const last = prompts[1].at(-1)?.content as { text: string }[];
  expect(last[0].text).toContain(
    "0:02: They sign a delivery note.\n\nQuestion: What did they sign?",
  );
});
