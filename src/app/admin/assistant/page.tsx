import type { Metadata } from "next";
import { Chat } from "@/components/chat";
import { customer } from "@/lib/customer";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
      <div className="mt-6 h-[70vh] rounded-xl border">
        <Chat id="admin" assistant={customer.assistant} />
      </div>
    </>
  );
}
