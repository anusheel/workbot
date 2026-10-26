"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LinkCode, type LinkTarget } from "./link-code";
import { Message } from "./message";

/** The numbers a conversation can continue on, and the action that issues a code for it. */
export type Phone = {
  targets: LinkTarget[];
  link: (conversationId: string) => Promise<string>;
};

type Props = {
  /** The assistant's name, from the customer; a client component cannot read the file. */
  assistant: string;
  id: string;
  initialMessages?: UIMessage[];
  /** Called with the whole conversation whenever a reply completes. */
  onMessages?: (messages: UIMessage[]) => void;
  phone?: Phone;
};

/** The AI SDK puts the raw response body in the message; show the sentence the route sent. */
export function errorText(error: Error): string {
  try {
    const body: unknown = JSON.parse(error.message);
    if (body && typeof body === "object" && "error" in body) {
      const text = (body as { error: unknown }).error;
      if (typeof text === "string") return text;
    }
  } catch {}
  return error.message;
}

export function Chat({
  id,
  assistant,
  initialMessages,
  onMessages,
  phone,
}: Props) {
  const {
    messages,
    sendMessage,
    regenerate,
    setMessages,
    status,
    error,
    stop,
  } = useChat({
    id,
    messages: initialMessages,
    // A reply that was still streaming when the page closed comes back from where the server kept it.
    resume: true,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const list = useRef<HTMLDivElement>(null);
  // Follow the stream only while the reader is at the bottom; scrolling up pauses it.
  const following = useRef(true);

  useEffect(() => {
    if (status === "ready" && messages.length) onMessages?.(messages);
  }, [status, messages, onMessages]);

  // The server's copy holds what was said on other channels since this browser last saw the conversation.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body?: { messages: UIMessage[] }) => {
        if (body)
          setMessages((current) =>
            body.messages.length > current.length ? body.messages : current,
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id, setMessages]);

  useEffect(() => {
    if (following.current)
      list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={list}
        onScroll={({ currentTarget: el }) => {
          following.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        role="log"
        aria-label="Conversation"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask about a policy, a request, or anything the team needs.
            </p>
          )}
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          {phone && messages.length > 0 && status === "ready" && (
            <LinkCode
              label="Continue on your phone"
              icon={<Smartphone />}
              instruction="Send this from your phone within 10 minutes, and the conversation carries on there:"
              targets={phone.targets}
              action={() => phone.link(id)}
            />
          )}
          {status === "submitted" && (
            <span
              className="size-2 animate-pulse rounded-full bg-foreground/40"
              role="status"
              aria-label="Thinking"
            />
          )}
          {error && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-destructive">{errorText(error)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => regenerate()}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="border-t"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-3 px-6 py-4">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={`Message ${assistant}`}
            aria-label="Message"
            className="max-h-40 min-h-0 flex-1 resize-none field-sizing-content"
          />
          {busy ? (
            <Button type="button" variant="outline" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              Send
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
