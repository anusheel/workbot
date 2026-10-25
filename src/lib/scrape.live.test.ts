import { expect, test } from "vitest";
import { z } from "zod";
import { chatModel } from "./chat";
import { scrape } from "./scrape";

test("the scraper pulls typed records from a real listing page and follows its next link", async () => {
  const Story = z.object({ title: z.string(), points: z.number().nullable() });
  const stories = await scrape(
    "https://news.ycombinator.com/",
    Story,
    chatModel("small"),
    { pages: 2 },
  );
  expect(stories.length).toBeGreaterThan(30);
  expect(stories.every((s) => s.title.length > 3)).toBe(true);
  expect(stories.some((s) => (s.points ?? 0) > 0)).toBe(true);
});
