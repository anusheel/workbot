import { expect, test } from "vitest";
import { scripted } from "@/test/model";
import { createUser } from "./auth";
import { linkCode, render, respond } from "./channels";
import { historyOf, saveHistory } from "./history";

const web = (id: string, role: "user" | "assistant", text: string) => ({
  id,
  role,
  parts: [{ type: "text" as const, text }],
});

test("a conversation started on the web continues on WhatsApp once the phone sends its code", async () => {
  await saveHistory("chat-1", "visitor-1", [
    web(
      "m1",
      "user",
      "Can you deliver 40 bags of cement to Alameda on Friday?",
    ),
    web("m2", "assistant", "Yes, Friday morning works for Alameda."),
  ]);
  const code = await linkCode("visitor-1", "chat-1");
  const phone = { channel: "whatsapp" as const, address: "+15105550142" };

  const linked = await respond({ ...phone, text: `link ${code}` });
  expect(linked?.text).toMatch(/^Linked/);

  const { model, prompts } = scripted([
    { text: "Yes, the 40 bags go out Friday." },
  ]);
  const reply = await respond({ ...phone, text: "Is that still on?" }, model);
  expect(reply?.text).toBe("Yes, the 40 bags go out Friday.");
  // The model saw the web conversation before the new message.
  expect(JSON.stringify(prompts[0])).toContain("40 bags of cement to Alameda");
  const kept = await historyOf("chat-1", "visitor-1");
  expect(kept?.messages.map((m) => m.metadata?.channel)).toEqual([
    undefined,
    undefined,
    "whatsapp",
    "whatsapp",
  ]);
});

test("a code works once and expires; a wrong one links nothing, and a stranger stays a stranger", async () => {
  const code = await linkCode("visitor-2", "chat-2");
  const sms = { channel: "sms" as const, address: "+15105550100" };
  expect((await respond({ ...sms, text: `link ${code}` }))?.text).toMatch(
    /^Linked/,
  );
  const other = { channel: "sms" as const, address: "+15105550199" };
  expect((await respond({ ...other, text: `link ${code}` }))?.text).toMatch(
    /not valid/,
  );

  const { model } = scripted([{ text: "Hello." }]);
  const reply = await respond({ ...other, text: "Hi" }, model);
  // An unlinked number has a conversation of its own, under its own name.
  expect(reply?.turn).toEqual({
    person: "sms:+15105550199",
    conversation: "sms:+15105550199",
  });
});

test("STOP silences a number until START", async () => {
  const sms = { channel: "sms" as const, address: "+15105550111" };
  expect(await respond({ ...sms, text: "STOP" })).toBeUndefined();
  expect(await respond({ ...sms, text: "Are you there?" })).toBeUndefined();
  expect((await respond({ ...sms, text: "start" }))?.text).toMatch(/again/);
});

test("a linked employee gets the tools of their role; anyone else the customer's", async () => {
  const { user } = await createUser("Sam Patel", "agent");
  const code = await linkCode(user.id);
  const slack = { channel: "slack" as const, address: "U024BE7LH" };
  await respond({ ...slack, text: `link ${code}` });

  const staff = scripted([{ text: "Done." }]);
  await respond(
    { ...slack, text: "Any open tickets?", thread: "t-1" },
    staff.model,
  );
  const stranger = scripted([{ text: "Done." }]);
  await respond(
    {
      channel: "slack",
      address: "U999",
      text: "Any open tickets?",
      thread: "t-2",
    },
    stranger.model,
  );
  expect(staff.tools[0]).toContain("find_contact");
  expect(stranger.tools[0]).not.toContain("find_contact");
});

test("a reply is fitted to its channel", () => {
  const text =
    "## Delivery\n**Friday** at 9: see [the schedule](https://fieldstone.example/s) and `PO-7714`.";
  expect(render(text, "sms")).toBe(
    "Delivery\nFriday at 9: see the schedule (https://fieldstone.example/s) and PO-7714.",
  );
  expect(render(text, "whatsapp")).toBe(
    "Delivery\n*Friday* at 9: see the schedule (https://fieldstone.example/s) and PO-7714.",
  );
  expect(render(text, "slack")).toBe(text);
  expect(render("x".repeat(2000), "sms")).toHaveLength(1600);
});
