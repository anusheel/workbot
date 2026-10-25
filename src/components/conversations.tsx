"use client";

import type { UIMessage } from "ai";
import { io } from "next/cache";
import { use, useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  getConversations,
  getServerConversations,
  saveConversations,
  subscribe,
  upsert,
} from "@/lib/conversations";
import { Chat } from "./chat";
import { ConversationList } from "./conversation-list";

/** The chat page: conversations kept in this browser, one open at a time. */
export function Conversations({ assistant }: { assistant: string }) {
  // The fresh id below is random, which must not be baked into the prerender.
  use(io());
  const conversations = useSyncExternalStore(
    subscribe,
    getConversations,
    getServerConversations,
  );
  const [chosen, setChosen] = useState<string>();
  const [fresh, setFresh] = useState(() => crypto.randomUUID());
  // The chosen conversation, else the most recent, else a new one.
  const activeId = chosen ?? conversations[0]?.id ?? fresh;
  const active = conversations.find((c) => c.id === activeId);

  const save = useCallback(
    (messages: UIMessage[]) =>
      saveConversations(upsert(getConversations(), activeId, messages)),
    [activeId],
  );
  const startNew = () => {
    const id = crypto.randomUUID();
    setFresh(id);
    setChosen(id);
  };

  return (
    // The page fills what the header leaves: the header is 3.5rem plus its border.
    <div className="flex h-[calc(100dvh-3.5rem-1px)]">
      <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={setChosen}
          onNew={startNew}
        />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        {/* On a phone the list gives way to a select and a button. */}
        <header className="flex items-center gap-2 border-b p-3 md:hidden">
          <NativeSelect
            value={activeId}
            onChange={(event) => setChosen(event.target.value)}
            aria-label="Conversation"
            className="min-w-0 flex-1"
          >
            {!active && (
              <NativeSelectOption value={activeId}>New chat</NativeSelectOption>
            )}
            {conversations.map((conversation) => (
              <NativeSelectOption key={conversation.id} value={conversation.id}>
                {conversation.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="button" variant="outline" onClick={startNew}>
            New
          </Button>
        </header>
        <div className="min-h-0 flex-1">
          <Chat
            assistant={assistant}
            key={activeId}
            id={activeId}
            initialMessages={active?.messages}
            onMessages={save}
          />
        </div>
      </main>
    </div>
  );
}
