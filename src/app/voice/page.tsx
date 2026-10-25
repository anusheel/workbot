import type { Metadata } from "next";
import { VoiceLine } from "@/components/voice-line";

export const metadata: Metadata = { title: "Voice line" };

export default function VoicePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Voice line</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Say what happened. WorkBot asks what it needs to know, files the
          request, and tells you where it went. You can talk over it.
        </p>
        <div className="mt-8">
          <VoiceLine />
        </div>
      </div>
    </main>
  );
}
