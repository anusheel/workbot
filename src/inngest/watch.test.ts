import { InngestTestEngine } from "@inngest/test";
import { expect, test } from "vitest";
import { listNotifications } from "@/lib/notify";
import { recordTrace } from "@/lib/tracing";
import { watch } from "./watch";

const trace = (ok: boolean, dollars = 0) =>
  recordTrace({
    caller: "t",
    name: "chat",
    model: "claude-haiku-5-5",
    input: 1,
    output: 1,
    cached: 0,
    dollars,
    ms: 10,
    ok,
    error: ok ? null : "boom",
  });

test("a failing hour and a day over budget each raise one alert in the outbox", async () => {
  for (let i = 0; i < 8; i++) await trace(true);
  for (let i = 0; i < 2; i++) await trace(false);
  await trace(true, 6);
  const { result } = await new InngestTestEngine({ function: watch }).execute();
  expect(result).toEqual({ alerts: 2 });
  const sent = (await listNotifications(2)).map((n) => n.message);
  expect(sent).toEqual(
    expect.arrayContaining([
      expect.stringContaining("2 of 11 model calls failed"),
      expect.stringContaining("over the $5 budget"),
    ]),
  );
});
