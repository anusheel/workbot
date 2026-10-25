import { Button } from "@/components/ui/button";
import { type Memory, kinds } from "@/lib/memory";
import { customer } from "@/lib/customer";

const titles = {
  preference: "Preferences",
  entity: "People, teams and systems",
  case: "Cases",
};

type Props = {
  memories: Memory[];
  onForget(id: string): Promise<void>;
  onForgetAll(): Promise<void>;
};

/** What WorkBot remembers about the visitor, grouped, each line with a way to forget it. */
export function MemoryList({ memories, onForget, onForgetAll }: Props) {
  if (memories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing yet. {customer.assistant} remembers what you tell it in chat.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {kinds
        .filter((kind) => memories.some((m) => m.kind === kind))
        .map((kind) => (
          <section key={kind}>
            <h3 className="text-sm font-medium text-muted-foreground">
              {titles[kind]}
            </h3>
            <ul className="mt-2 divide-y">
              {memories
                .filter((m) => m.kind === kind)
                .map((memory) => (
                  <li
                    key={memory.id}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span>{memory.text}</span>
                    <form action={onForget.bind(null, memory.id)}>
                      <Button type="submit" variant="ghost" size="xs">
                        Forget
                      </Button>
                    </form>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      <form action={onForgetAll}>
        <Button type="submit" variant="outline">
          Forget everything
        </Button>
      </form>
    </div>
  );
}
