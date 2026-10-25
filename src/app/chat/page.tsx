import type { Metadata } from "next";
import { Suspense } from "react";
import { Conversations } from "@/components/conversations";
import { customer } from "@/lib/customer";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <Suspense>
      <Conversations assistant={customer.assistant} />
    </Suspense>
  );
}
