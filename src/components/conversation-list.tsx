import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/conversations";

type Props = {
  conversations: Conversation[];
  activeId: string;
  onSelect(id: string): void;
  onNew(): void;
};

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: Props) {
  return (
    <nav aria-label="Conversations" className="flex h-full flex-col gap-3">
      <Button type="button" variant="outline" onClick={onNew}>
        New chat
      </Button>
      <ul className="flex flex-col gap-0.5 overflow-y-auto">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Button
              type="button"
              variant={conversation.id === activeId ? "secondary" : "ghost"}
              size="sm"
              aria-current={conversation.id === activeId || undefined}
              onClick={() => onSelect(conversation.id)}
              className="w-full justify-start font-normal"
            >
              <span className="truncate">{conversation.title}</span>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
