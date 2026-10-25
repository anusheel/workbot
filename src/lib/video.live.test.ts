import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright-core";
import { afterAll, beforeAll, expect, test } from "vitest";
import { modelFor } from "./routing";
import {
  askRecording,
  describeFrames,
  extractFrames,
  summarize,
} from "./video";

// A 9-second recording of 3 scenes, each a labelled card drawn by Chrome,
// so the model's descriptions can be checked against what was on screen.
const scenes = [
  ["RECEIVING DOCK", "#2b4c7e"],
  ["FORKLIFT AISLE 4", "#7e2b2b"],
  ["PACKING BENCH", "#2b7e4c"],
];
let dir: string;
let video: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "workbot-recording-"));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  for (const [index, [label, colour]] of scenes.entries()) {
    await page.setContent(
      `<body style="margin:0;height:100vh;display:grid;place-items:center;background:${colour};color:white;font:bold 56px sans-serif">${label}</body>`,
    );
    await writeFile(
      join(dir, `frame${index + 1}.png`),
      await page.screenshot(),
    );
  }
  await browser.close();
  video = join(dir, "walk.mp4");
  await promisify(execFile)("ffmpeg", [
    "-loglevel",
    "error",
    "-framerate",
    "1/3",
    "-i",
    join(dir, "frame%d.png"),
    "-r",
    "10",
    "-pix_fmt",
    "yuv420p",
    video,
  ]);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

test("the small model reads each scene, writes the timeline, and answers a question from it", async () => {
  const model = modelFor("read");
  const frames = await extractFrames(video, { every: 3 });
  expect(frames.map((f) => f.at)).toEqual([0, 3, 6]);
  const described = await describeFrames(frames, model);
  expect(described).toHaveLength(3);
  for (const [index, [label]] of scenes.entries()) {
    expect(described[index].text.toUpperCase()).toContain(label.split(" ")[0]);
  }
  const timeline = await summarize(described, model);
  expect(timeline).toMatch(/0:00/);
  expect(timeline.split("\n").length).toBeGreaterThanOrEqual(2);
  const answer = await askRecording(
    described,
    "What did the second scene say, and when?",
    model,
  );
  expect(answer).toMatch(/forklift/i);
  expect(answer).toMatch(/0:03/);
}, 180_000);
