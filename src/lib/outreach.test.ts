import { expect, test } from "vitest";
import { GET, POST } from "@/app/api/unsubscribe/route";
import { config } from "./config";
import {
  addressOf,
  compose,
  due,
  sequence,
  unsubscribeToken,
} from "./outreach";

config.secrets.key = Buffer.alloc(32, 7).toString("base64");
const sender = {
  name: "WorkBot",
  postal: "1 Market St, Oakland, CA 94607",
  url: "https://workbot.example",
};

test("every email names its sender, gives a postal address, and unsubscribes in one click", () => {
  const email = compose(
    0,
    "Valley Block",
    "orders@valleyblock.example",
    sender,
  );
  expect(email.subject).toBe("Orders by text at Valley Block");
  expect(email.text).toContain(sender.postal);
  expect(email.headers["List-Unsubscribe-Post"]).toBe(
    "List-Unsubscribe=One-Click",
  );
  expect(email.headers["List-Unsubscribe"]).toContain(
    unsubscribeToken("orders@valleyblock.example"),
  );
});

test("a token works only for the address it was signed for", () => {
  const token = unsubscribeToken("Orders@ValleyBlock.example");
  expect(addressOf(token)).toBe("orders@valleyblock.example");
  expect(addressOf(`${token.split(".")[0]}.forged`)).toBeUndefined();
});

test("the sequence waits its days, stops at a reply, and stops for good at an unsubscribe, which a link preview cannot make", async () => {
  const start = new Date("2026-10-01");
  const on = (day: number) => new Date(start.getTime() + day * 86_400_000);
  expect(
    await due("orders@valleyblock.example", start, 1, false, on(2)),
  ).toBeUndefined();
  expect(await due("orders@valleyblock.example", start, 1, false, on(4))).toBe(
    1,
  );
  expect(
    await due("orders@valleyblock.example", start, 1, true, on(4)),
  ).toBeUndefined();
  expect(
    await due(
      "orders@valleyblock.example",
      start,
      sequence.length,
      false,
      on(30),
    ),
  ).toBeUndefined();

  const link = `https://workbot.example/api/unsubscribe?token=${unsubscribeToken("orders@valleyblock.example")}`;
  expect((await GET(new Request(link))).status).toBe(200);
  expect(await due("orders@valleyblock.example", start, 1, false, on(4))).toBe(
    1,
  );
  expect((await POST(new Request(link, { method: "POST" }))).status).toBe(200);
  expect(
    await due("orders@valleyblock.example", start, 1, false, on(4)),
  ).toBeUndefined();
  const forged = "https://workbot.example/api/unsubscribe?token=x.y";
  expect((await POST(new Request(forged, { method: "POST" }))).status).toBe(
    400,
  );
});
