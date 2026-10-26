import { expect, test } from "vitest";
import { record, resume } from "./resumable";

const read = (stream: ReadableStream<string>) =>
  new Response(stream.pipeThrough(new TextEncoderStream())).text();

/** A stream the test writes to as it likes, the way a model's reply arrives. */
function source() {
  let push!: (chunk: string) => void;
  let end!: () => void;
  const stream = new ReadableStream<string>({
    start(controller) {
      push = (chunk) => controller.enqueue(chunk);
      end = () => controller.close();
    },
  });
  return { stream, push, end };
}

test("a reader who lost the reply mid-way reads it again from the start and follows it to the end", async () => {
  const reply = source();
  const recording = record("s-1", "chat-1", "visitor-1", reply.stream);
  reply.push("data: Fri");
  reply.push("day at 9");
  await new Promise((resolve) => setTimeout(resolve, 150));
  reply.push(" works.\n\n");

  // The browser reloaded: it asks for the reply under way, while the reply is still being written.
  const resumed = await resume("chat-1", "visitor-1", { poll: 20 });
  expect(resumed).toBeDefined();
  const reading = read(resumed!);
  await new Promise((resolve) => setTimeout(resolve, 150));
  reply.push("data: [DONE]\n\n");
  reply.end();
  await recording;
  expect(await reading).toBe("data: Friday at 9 works.\n\ndata: [DONE]\n\n");
});

test("nothing is resumed once the reply is done, nor for someone else", async () => {
  const reply = source();
  const recording = record("s-2", "chat-2", "visitor-2", reply.stream);
  reply.push("data: hi\n\n");
  expect(await resume("chat-2", "visitor-9")).toBeUndefined();
  reply.end();
  await recording;
  expect(await resume("chat-2", "visitor-2")).toBeUndefined();
});
