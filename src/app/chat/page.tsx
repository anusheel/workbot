import type { Metadata } from "next";
import { Suspense } from "react";
import { Conversations } from "@/components/conversations";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <Suspense>
      <Conversations />
    </Suspense>
  );
}
