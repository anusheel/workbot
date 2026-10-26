import { expect, test, vi } from "vitest";
import { inngest } from "@/inngest/client";
import { deadLetter, listDeadLetters } from "@/lib/dead-letters";
import { query } from "@/lib/db";
import { getItem, receive } from "@/lib/inbox";
import { signIn } from "@/test/auth";
import { replay } from "./actions";

vi.mock("next/headers", async () => ({
  headers: async () => (await import("@/test/caller")).caller.headers,
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async () => ({ ids: [] })) },
}));

await signIn("admin");

const letterFor = async (source: string) =>
  (await listDeadLetters()).find((l) => l.source === source)!;

test("a dead-lettered document goes back to the workflow once, its row reset to received", async () => {
  const item = await receive(
    "broken.pdf",
    "application/pdf",
    new Uint8Array([37]),
    "acme-sync",
  );
  await query(`update inbox set status = 'failed' where id = $1`, [item.id]);
  await deadLetter(
    "job:document",
    "acme-sync",
    { name: "document/received", data: { id: item.id, owner: "acme-sync" } },
    new Error("Invalid PDF"),
  );
  const letter = await letterFor("job:document");
  await replay(letter.id);
  await replay(letter.id);
  expect((await getItem(item.id))?.status).toBe("received");
  expect(vi.mocked(inngest.send)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(inngest.send)).toHaveBeenCalledWith(
    expect.objectContaining({ data: { id: item.id, owner: "acme-sync" } }),
  );
});

test("a dead-lettered event goes back to its consumer", async () => {
  await deadLetter(
    "event:notifications",
    "r-9",
    {
      id: "9001",
      topic: "request.created",
      version: 1,
      key: "r-9",
      data: {
        id: "r-9",
        title: "Dock door 4 stuck",
        team: "operations",
        priority: "high",
      },
    },
    new Error("database was down"),
    3,
  );
  await replay((await letterFor("event:notifications")).id);
  expect(
    await query(
      `select id from notifications where message = 'New request: Dock door 4 stuck'`,
    ),
  ).toHaveLength(1);
});

test("a send-back that fails leaves the letter for another try", async () => {
  await deadLetter(
    "event:notifications",
    "r-bad",
    {
      id: "9002",
      topic: "request.created",
      version: 2,
      key: "r-bad",
      data: {},
    },
    new Error("No reader for request.created version 2"),
    3,
  );
  const letter = (await listDeadLetters()).find((l) => l.owner === "r-bad")!;
  await expect(replay(letter.id)).rejects.toThrow("No reader");
  expect(
    (await listDeadLetters()).find((l) => l.id === letter.id)?.replayedAt,
  ).toBeNull();
});
