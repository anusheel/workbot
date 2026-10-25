import { expect, test } from "vitest";
import { addVersion, promptOf, setShares, versions } from "./prompts";

test("a prompt is seeded from the code on first use, and new versions carry no traffic until given a share", async () => {
  const first = await promptOf("test/greeting", "visitor-a", "Say hello.");
  expect(first).toMatchObject({ version: 1, text: "Say hello." });
  const second = await addVersion(
    "test/greeting",
    "Say hello, briefly.",
    "shorter",
  );
  expect(second).toMatchObject({ version: 2, share: 0 });
  expect(await promptOf("test/greeting", "visitor-a", "ignored")).toMatchObject(
    { version: 1 },
  );
  expect((await versions("test/greeting")).map((v) => v.version)).toEqual([
    2, 1,
  ]);
});

test("traffic splits by share, and a tenant always lands on the same version", async () => {
  await promptOf("test/split", "x", "A");
  await addVersion("test/split", "B");
  await expect(setShares("test/split", { 1: 60, 2: 30 })).rejects.toThrow("90");
  await setShares("test/split", { 1: 50, 2: 50 });
  const picks = new Map<number, number>();
  for (let i = 0; i < 200; i++) {
    const { version } = await promptOf("test/split", `tenant-${i}`, "A");
    picks.set(version, (picks.get(version) ?? 0) + 1);
  }
  expect(picks.get(1)).toBeGreaterThan(60);
  expect(picks.get(2)).toBeGreaterThan(60);
  const again = await promptOf("test/split", "tenant-7", "A");
  expect(again.version).toBe(
    (await promptOf("test/split", "tenant-7", "A")).version,
  );
  await setShares("test/split", { 2: 100 });
  expect((await promptOf("test/split", "anyone", "A")).text).toBe("B");
});

test("2 first requests at once seed the prompt once, and both get it", async () => {
  const [a, b] = await Promise.all([
    promptOf("test/race", "one", "Seeded."),
    promptOf("test/race", "two", "Seeded."),
  ]);
  expect(a).toMatchObject({ version: 1, text: "Seeded." });
  expect(b).toMatchObject({ version: 1, text: "Seeded." });
  expect(await versions("test/race")).toHaveLength(1);
});

test("setShares rejects shares outside 0 to 100 and unknown versions, and leaves the shares unchanged", async () => {
  await promptOf("test/bad-shares", "x", "A");
  await addVersion("test/bad-shares", "B");
  await expect(
    setShares("test/bad-shares", { 1: 150, 2: -50 }),
  ).rejects.toThrow("150");
  await expect(
    setShares("test/bad-shares", { 1: 50.5, 2: 49.5 }),
  ).rejects.toThrow("50.5");
  await expect(setShares("test/bad-shares", { 9: 100 })).rejects.toThrow("9");
  expect((await versions("test/bad-shares")).map((v) => v.share)).toEqual([
    0, 100,
  ]);
  expect((await promptOf("test/bad-shares", "anyone", "A")).version).toBe(1);
});
