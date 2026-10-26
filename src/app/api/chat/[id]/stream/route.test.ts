import { expect, test, vi } from "vitest";
import { record } from "@/lib/resumable";
import { GET } from "./route";

vi.mock("@/lib/visitor", () => ({ visitorId: async () => "visitor-3" }));

const get = (id: string) =>
  GET(new Request(`http://workbot/api/chat/${id}/stream`), {
    params: Promise.resolve({ id }),
  });

test("a reply under way is replayed as an event stream; none answers 204", async () => {
  let end!: () => void;
  const reply = new ReadableStream<string>({
    start(controller) {
      controller.enqueue('data: {"type":"text-delta","delta":"Friday"}\n\n');
      end = () => controller.close();
    },
  });
  const recording = record("s-9", "chat-9", "visitor-3", reply);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const response = await get("chat-9");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  end();
  await recording;
  expect(await response.text()).toBe(
    'data: {"type":"text-delta","delta":"Friday"}\n\n',
  );
  expect((await get("chat-9")).status).toBe(204);
  expect((await get("chat-none")).status).toBe(204);
});
