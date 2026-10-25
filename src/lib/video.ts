import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { type LanguageModel, Output, generateText } from "ai";
import { z } from "zod";

export type Frame = { at: number; png: Uint8Array };
export type Scene = { at: number; text: string };

/** Seconds as m:ss. */
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** ffprobe prints N/A for a file with no duration header; the fallback stands in for it. */
export function parseDuration(stdout: string, fallback = 0): number {
  const seconds = Number(stdout);
  return stdout.trim() && Number.isFinite(seconds) ? seconds : fallback;
}

/** The length of a recording in seconds, from ffprobe or, without a header, from its frames. */
export async function duration(file: string, every = 2): Promise<number> {
  const { stdout } = await promisify(execFile)("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const seconds = parseDuration(stdout, NaN);
  if (!Number.isNaN(seconds)) return seconds;
  const frames = await extractFrames(file, { every });
  return frames.length * every;
}

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * One frame every `every` seconds, as PNGs straight from ffmpeg's output:
 * no files on disk, the stream cut at each PNG signature. Frames are scaled
 * to at most 1024 pixels wide, which bounds memory and what the model is sent.
 */
export function extractFrames(
  file: string,
  { every = 2, limit = 90 } = {},
): Promise<Frame[]> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-loglevel",
      "error",
      "-i",
      file,
      "-vf",
      `fps=1/${every},scale='min(1024,iw)':-2`,
      "-frames:v",
      String(limit),
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "-",
    ]);
    const chunks: Buffer[] = [];
    let errors = "";
    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk: Buffer) => (errors += chunk));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(errors.trim() || `ffmpeg exited with ${code}`));
      const bytes = Buffer.concat(chunks);
      const starts: number[] = [];
      for (
        let i = bytes.indexOf(signature);
        i !== -1;
        i = bytes.indexOf(signature, i + signature.length)
      )
        starts.push(i);
      resolve(
        starts.map((start, index) => ({
          at: index * every,
          png: new Uint8Array(bytes.subarray(start, starts[index + 1])),
        })),
      );
    });
  });
}

const Scenes = z.object({
  scenes: z.array(
    z.object({
      at: z.number().describe("the frame's time in seconds, as given"),
      text: z.string(),
    }),
  ),
});

/** What is on screen at each frame: a batch of frames per model call, each labelled with its time. */
export async function describeFrames(
  frames: Frame[],
  model: LanguageModel,
  { batch = 8 } = {},
): Promise<Scene[]> {
  const scenes: Scene[] = [];
  for (let i = 0; i < frames.length; i += batch) {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: Scenes }),
      instructions:
        "You describe frames from a recording for a work log. For each frame, 1 or 2 plain sentences: what is on screen, any text that can be read, and what changed since the frame before. Keep each frame's time as given.",
      messages: [
        {
          role: "user",
          content: frames.slice(i, i + batch).flatMap((frame) => [
            {
              type: "text" as const,
              text: `Frame at ${clock(frame.at)} (${frame.at} seconds):`,
            },
            { type: "file" as const, data: frame.png, mediaType: "image/png" },
          ]),
        },
      ],
    });
    scenes.push(...output.scenes);
  }
  return scenes;
}

const notes = (scenes: Scene[]) =>
  scenes.map((scene) => `${clock(scene.at)}: ${scene.text}`).join("\n");

/** The recording as a timeline: one line per span of time and what happened in it. */
export async function summarize(
  scenes: Scene[],
  model: LanguageModel,
): Promise<string> {
  const { text } = await generateText({
    model,
    instructions:
      "You write the timeline of a recording from descriptions of its frames. Merge consecutive frames that show the same thing into one span. One line per span: the span as m:ss-m:ss, a colon, then what happens, in plain sentences. No heading and no preamble.",
    prompt: notes(scenes),
  });
  return text.trim();
}

/** A question about the recording, answered from what the frames showed. */
export async function askRecording(
  scenes: Scene[],
  question: string,
  model: LanguageModel,
): Promise<string> {
  const { text } = await generateText({
    model,
    instructions:
      "You answer a question about a recording from descriptions of its frames, each with its time. Answer in plain sentences, with the time it was seen. When the descriptions do not say, say so.",
    prompt: `${notes(scenes)}\n\nQuestion: ${question}`,
  });
  return text.trim();
}
