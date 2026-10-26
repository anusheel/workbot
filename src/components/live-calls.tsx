"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Frame } from "@/lib/realtime";
import { reconnecting } from "@/lib/socket";

type Line = { who: "caller" | "assistant" | "team"; text: string };
type Call = { id: string; lines: Line[]; ended: boolean };

/** Each frame as the lines of the call it belongs to. */
export function linesOf(frame: Frame): Line[] {
  const { event } = frame;
  if (event.type === "turn")
    return [
      { who: "caller", text: String(event.heard) },
      { who: "assistant", text: String(event.reply) },
    ];
  if (event.type === "note") return [{ who: "team", text: String(event.text) }];
  return [];
}

/**
 * Every live voice call, as it happens, for staff: each call's turns, and a
 * line to speak into it. The page may be connected to a different instance
 * of the realtime server from the caller's; the frames meet in Postgres.
 */
export function LiveCalls({
  url,
  assistant,
  canSpeak,
}: {
  url: string;
  /** The assistant's name, from the customer; a client component cannot read the file. */
  assistant: string;
  canSpeak: boolean;
}) {
  const socket = useRef<ReturnType<typeof reconnecting>>(undefined);
  const [calls, setCalls] = useState<Call[]>([]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    socket.current = reconnecting(`${url}?call=*`, {
      open: () => setConnected(true),
      close: () => setConnected(false),
      message(data) {
        const frame = JSON.parse(data) as Frame;
        setCalls((previous) => {
          const existing = previous.find((c) => c.id === frame.call);
          const call = existing ?? { id: frame.call, lines: [], ended: false };
          const updated = {
            ...call,
            lines: [...call.lines, ...linesOf(frame)],
            ended: call.ended || frame.event.type === "end",
          };
          return [updated, ...previous.filter((c) => c.id !== frame.call)];
        });
      },
    });
    return socket.current.stop;
  }, [url]);
  const speak = (call: string, text: string) =>
    socket.current?.send(
      JSON.stringify({ call, event: { type: "note", text } }),
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {connected ? "Listening" : "Connecting"} on {url}
      </p>
      {calls.length === 0 && (
        <p className="text-sm text-muted-foreground">No calls yet.</p>
      )}
      {calls.map((call) => (
        <CallCard
          key={call.id}
          call={call}
          assistant={assistant}
          onSpeak={canSpeak ? (text) => speak(call.id, text) : undefined}
        />
      ))}
    </div>
  );
}

function CallCard({
  call,
  assistant,
  onSpeak,
}: {
  call: Call;
  assistant: string;
  onSpeak?: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          Call {call.id.slice(0, 8)}
        </span>
        <Badge variant={call.ended ? "outline" : "secondary"}>
          {call.ended ? "Ended" : "Live"}
        </Badge>
      </div>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {call.lines.map((line, i) => (
          <li key={i}>
            <span className="text-muted-foreground">
              {line.who === "caller"
                ? "Caller"
                : line.who === "assistant"
                  ? assistant
                  : "Team"}
              :
            </span>{" "}
            {line.text}
          </li>
        ))}
      </ul>
      {onSpeak && !call.ended && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim()) return;
            onSpeak(text.trim());
            setText("");
          }}
        >
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Say something to the caller"
            aria-label="Note to the caller"
          />
          <Button type="submit" variant="outline">
            <Send /> Send
          </Button>
        </form>
      )}
    </div>
  );
}
