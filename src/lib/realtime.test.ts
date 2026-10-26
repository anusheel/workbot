import type { AddressInfo } from "node:net";
import { afterAll, expect, test } from "vitest";
import WebSocket from "ws";
import { createUser, sessionCookie, startSession } from "./auth";
import { type Frame, startRealtime } from "./realtime";

// Two instances, as behind a load balancer; they share only the database.
const first = await startRealtime(0);
const second = await startRealtime(0);
afterAll(() => {
  first.close();
  second.close();
});
const url = (server: typeof first, call: string) =>
  `ws://127.0.0.1:${(server.address() as AddressInfo).port}/?call=${call}`;

const open = (address: string, cookie?: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(address, { headers: cookie ? { cookie } : {} });
    ws.once("open", () => resolve(ws));
    ws.once("unexpected-response", (_, response) =>
      reject(new Error(String(response.statusCode))),
    );
  });
const next = (ws: WebSocket) =>
  new Promise<Frame>((resolve) =>
    ws.once("message", (data) => resolve(JSON.parse(data.toString()))),
  );
const staff = async (role: "viewer" | "agent") => {
  const { key } = await createUser(`A ${role}`, role);
  return `${sessionCookie}=${encodeURIComponent((await startSession(key))!.token)}`;
};

test("a call on one instance is followed from the other, and an agent's note reaches the caller", async () => {
  const caller = await open(url(first, "call-1"));
  const supervisor = await open(url(second, "*"), await staff("agent"));
  const heard = next(supervisor);
  caller.send(
    JSON.stringify({
      event: { type: "turn", heard: "Is the yard open?", reply: "Until 6." },
    }),
  );
  expect(await heard).toEqual({
    call: "call-1",
    from: "caller",
    event: { type: "turn", heard: "Is the yard open?", reply: "Until 6." },
  });

  const note = next(caller);
  const echoed = next(supervisor);
  supervisor.send(
    JSON.stringify({
      call: "call-1",
      event: { type: "note", text: "A person is here." },
    }),
  );
  expect((await note).event).toEqual({
    type: "note",
    text: "A person is here.",
  });
  // Staff watching see what a colleague said into the call.
  expect((await echoed).from).toBe("staff");
  caller.close();
  supervisor.close();
});

test("watching every call needs staff, and a viewer may watch but not speak", async () => {
  await expect(open(url(first, "*"))).rejects.toThrow("403");
  const caller = await open(url(first, "call-2"));
  const viewer = await open(url(second, "*"), await staff("viewer"));
  let reached = false;
  caller.on("message", () => (reached = true));
  viewer.send(
    JSON.stringify({ call: "call-2", event: { type: "note", text: "hello" } }),
  );
  // A frame from the caller, sent after the viewer's, arrives; the viewer's never did.
  const watched = next(viewer);
  caller.send(JSON.stringify({ event: { type: "end" } }));
  expect((await watched).event.type).toBe("end");
  expect(reached).toBe(false);
  caller.close();
  viewer.close();
});
