"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Frame } from "@/lib/realtime";

/**
 * A voice call's line to the team, when a realtime server is configured:
 * the call joins a room named by an id only it holds, publishes what happens
 * on it, and hears what a person from the team says into it.
 */
export function useLiveCall(url: string | undefined) {
  const socket = useRef<WebSocket>(undefined);
  const [notes, setNotes] = useState<string[]>([]);
  useEffect(() => {
    if (!url) return;
    const ws = new WebSocket(`${url}?call=${crypto.randomUUID()}`);
    ws.onmessage = ({ data }) => {
      const { event } = JSON.parse(String(data)) as Frame;
      if (event.type === "note" && typeof event.text === "string")
        setNotes((previous) => [...previous, event.text as string]);
    };
    socket.current = ws;
    return () => ws.close();
  }, [url]);
  const publish = useCallback((event: Frame["event"]) => {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ event }));
  }, []);
  return { publish, notes };
}
