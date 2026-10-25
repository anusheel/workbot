import { parseArgs } from "node:util";
import { modelFor } from "@/lib/routing";
import { close } from "@/lib/db";
import {
  askRecording,
  describeFrames,
  extractFrames,
  summarize,
} from "@/lib/video";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { every: { type: "string", default: "2" }, ask: { type: "string" } },
});
const [file] = positionals;
if (!file) {
  console.error('Usage: pnpm video <file> [--every 2] [--ask "<question>"]');
  process.exit(1);
}

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const model = modelFor("read");
const frames = await extractFrames(file, { every: Number(values.every) });
console.log(dim(`${frames.length} frames, 1 every ${values.every} seconds`));
const scenes = await describeFrames(frames, model);
console.log(await summarize(scenes, model));
if (values.ask) {
  console.log(
    `\n${dim(values.ask)}\n${await askRecording(scenes, values.ask, model)}`,
  );
}
await close();
