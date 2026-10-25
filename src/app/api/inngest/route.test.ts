import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { GET } from "./route";

test("the engine can read the functions this app serves", async () => {
  const response = await GET(new NextRequest("http://workbot/api/inngest"), {
    params: Promise.resolve({}),
  });
  expect(response.status).toBe(200);
  // The approval workflow, its failure handler, the reminders and the watch.
  expect(await response.json()).toMatchObject({ function_count: 4 });
});
