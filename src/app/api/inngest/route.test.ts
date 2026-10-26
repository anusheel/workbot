import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { GET } from "./route";

test("the engine can read the functions this app serves", async () => {
  const response = await GET(new NextRequest("http://workbot/api/inngest"), {
    params: Promise.resolve({}),
  });
  expect(response.status).toBe(200);
  // The 8 functions, and a failure handler each for the document approval and the channel reply.
  expect(await response.json()).toMatchObject({ function_count: 10 });
});
