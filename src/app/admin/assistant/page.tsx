import type { Metadata } from "next";
import { Chat } from "@/components/chat";
import { customer } from "@/lib/customer";
import { Suspense } from "react";
import { SignedIn } from "@/components/allowed";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
      <Suspense>
        <SignedIn>
          <div className="mt-6 h-[70vh] rounded-xl border">
            <Chat id="admin" assistant={customer.assistant} />
          </div>
        </SignedIn>
      </Suspense>
    </>
  );
}
