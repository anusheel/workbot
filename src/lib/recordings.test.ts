import { expect, test } from "vitest";
import { getRecording, listRecordings, saveRecording } from "./recordings";
import { createRequest } from "./requests";

test("a recording's timeline and scenes are filed on the request, in order", async () => {
  const request = await createRequest({
    title: "Dock camera, Tuesday morning",
    body: "",
    team: "operations",
    priority: "normal",
  });
  expect(await listRecordings(request.id)).toEqual([]);
  const first = await saveRecording(request.id, {
    name: "dock-0700.mp4",
    seconds: 42,
    scenes: [{ at: 0, text: "A pallet arrives at bay 2." }],
    summary: "0:00-0:42: A pallet arrives at bay 2 and is signed for.",
  });
  await saveRecording(request.id, {
    name: "dock-0800.mp4",
    seconds: 10,
    scenes: [],
    summary: "0:00-0:10: An empty bay.",
  });
  const listed = await listRecordings(request.id);
  expect(listed.map((r) => r.name)).toEqual(["dock-0700.mp4", "dock-0800.mp4"]);
  expect(await getRecording(first.id)).toEqual(first);
  expect(first.scenes).toEqual([{ at: 0, text: "A pallet arrives at bay 2." }]);
  expect(first.createdAt).toBeInstanceOf(Date);
});
