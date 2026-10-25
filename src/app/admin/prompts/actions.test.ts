import { expect, test } from "vitest";
import { addVersion, promptOf, versions } from "@/lib/prompts";
import { createVersion, splitTraffic } from "./actions";

test("a split that does not total 100 returns a message with the entered shares and stores nothing", async () => {
  await promptOf("test/actions-split", "x", "A prompt of enough length.");
  await addVersion("test/actions-split", "Another prompt of enough length.");
  const form = new FormData();
  form.set("share-1", "50");
  form.set("share-2", "40");

  const state = await splitTraffic("test/actions-split", {}, form);

  expect(state).toEqual({
    message: "Shares add up to 90, not 100.",
    shares: { 1: "50", 2: "40" },
  });
  const stored = await versions("test/actions-split");
  expect(stored.map((v) => v.share).sort()).toEqual([0, 100]);
});

test("a prompt under 20 characters returns a message and files no version", async () => {
  const form = new FormData();
  form.set("name", "test/actions-short");
  form.set("text", "too short");
  form.set("note", "n");

  const state = await createVersion({}, form);

  expect(state.errors?.text).toBeDefined();
  expect(state).toMatchObject({ text: "too short", note: "n" });
  expect(await versions("test/actions-short")).toEqual([]);
});
