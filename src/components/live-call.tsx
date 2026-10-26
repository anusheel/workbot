"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Frame } from "@/lib/realtime";
import { reconnecting } from "@/lib/socket";

/**
 * A voice call's line to the team, when a realtime server is configured:
 * the call joins a room named by an id only it holds, publishes what happens
 * on it, and hears what a person from the team says into it. A reconnect
 * keeps the id, so the call stays one call on the team's page.
 */
export function useLiveCall(url: string | undefined) {
  const line = useRef<ReturnType<typeof reconnecting>>(undefined);
  const [notes, setNotes] = useState<string[]>([]);
  useEffect(() => {
    if (!url) return;
    line.current = reconnecting(`${url}?call=${crypto.randomUUID()}`, {
      message(data) {
        const { event } = JSON.parse(data) as Frame;
        if (event.type === "note" && typeof event.text === "string")
          setNotes((previous) => [...previous, event.text as string]);
      },
    });
    return line.current.stop;
  }, [url]);
  const publish = useCallback(
    (event: Frame["event"]) => line.current?.send(JSON.stringify({ event })),
    [],
  );
  return { publish, notes };
}
