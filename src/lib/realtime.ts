import { type Server, createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { type Role, permits, sessionCookie, userBySession } from "./auth";
import { config } from "./config";
import { listen, notify } from "./db";

/** A frame on a call: which call, who sent it, and what happened. */
export type Frame = {
  call: string;
  from: "caller" | "staff";
  event: { type: string; [field: string]: unknown };
};

// A notification's payload is at most 8,000 bytes; a frame is a turn of speech, well under.
const maxFrame = 4000;
// Postgres's channels are shared by every tenant on the database, so the name says whose.
const channel = `calls_${config.customer.replaceAll("-", "_")}`;

/** A frame from a socket, or nothing for one too long or not JSON. */
function read(
  text: string,
): { call?: string; event?: Frame["event"] } | undefined {
  if (text.length > maxFrame) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The role of the staff member a request's session cookie belongs to, if any. */
async function staff(cookie = ""): Promise<Role | undefined> {
  const token = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === sessionCookie)?.[1];
  return token
    ? (await userBySession(decodeURIComponent(token)))?.role
    : undefined;
}

/**
 * One instance of the realtime server, for live voice calls. A caller's page
 * joins its own call, named by an id only it holds, and publishes what
 * happens on it; staff watch every call, and an agent can speak into one.
 * Every frame goes through Postgres (NOTIFY, and LISTEN on each instance),
 * so a supervisor connected to one instance follows a call connected to
 * another: run as many as the load needs.
 */
export async function startRealtime(port: number): Promise<Server> {
  // The sockets on this instance, by the call they joined; "*" is staff watching every call.
  const rooms = new Map<string, Set<WebSocket>>();
  await listen(channel, (payload) => {
    const frame = JSON.parse(payload) as Frame;
    // Staff watching see everything on every call; the caller hears only what staff say into its call.
    const listeners = [
      ...(rooms.get("*") ?? []),
      ...(frame.from === "staff" ? (rooms.get(frame.call) ?? []) : []),
    ];
    for (const socket of listeners)
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  });

  const sockets = new WebSocketServer({ noServer: true });
  const server = createServer((_, response) =>
    response
      .writeHead(426, { "content-type": "text/plain" })
      .end("WebSocket only"),
  );
  server.on("upgrade", async (request, socket, head) => {
    const call = new URL(
      request.url ?? "/",
      "http://realtime",
    ).searchParams.get("call");
    const role = await staff(request.headers.cookie);
    const caller = !!call && call !== "*";
    // Watching every call is for staff; a caller needs only the id of its own call.
    if (!call || (!caller && !role)) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => {
      const room = rooms.get(call) ?? new Set<WebSocket>();
      rooms.set(call, room.add(ws));
      ws.on("close", () => {
        room.delete(ws);
        if (room.size === 0) rooms.delete(call);
      });
      ws.on("message", async (data) => {
        const parsed = read(data.toString());
        if (!parsed?.event?.type) return;
        // A caller speaks only into its own call; staff name the call they speak into, and only an agent may.
        const frame: Frame | undefined = caller
          ? { call, from: "caller", event: parsed.event }
          : role && permits(role, "agent") && parsed.call
            ? { call: parsed.call, from: "staff", event: parsed.event }
            : undefined;
        if (frame) await notify(channel, JSON.stringify(frame));
      });
    });
  });
  await new Promise<void>((done) => server.listen(port, done));
  return server;
}
