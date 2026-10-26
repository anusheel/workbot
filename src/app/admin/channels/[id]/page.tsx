import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Message } from "@/components/message";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { when } from "@/lib/format";
import { historyById } from "@/lib/history";

export default function ConversationPage(
  props: PageProps<"/admin/channels/[id]">,
) {
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2.5">
        <Link href="/admin/channels">
          <ArrowLeft /> Channels
        </Link>
      </Button>
      <Suspense
        fallback={
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Transcript params={props.params} />
      </Suspense>
    </>
  );
}

/** A conversation as it ran, each message marked with the channel it came by. */
async function Transcript({
  params,
}: Pick<PageProps<"/admin/channels/[id]">, "params">) {
  await requireUser();
  const history = await historyById(decodeURIComponent((await params).id));
  if (!history) notFound();
  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Conversation
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {history.messages.length} messages, last {when(history.updatedAt)}.
      </p>
      <div className="mt-8 flex max-w-2xl flex-col gap-6">
        {history.messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </div>
    </>
  );
}
