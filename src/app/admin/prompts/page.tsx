import type { Metadata } from "next";
import { Suspense } from "react";
import { promptOf, versions } from "@/lib/prompts";
import { systemPrompt } from "@/lib/system-prompt";
import { SplitForm, VersionForm } from "./prompt-forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Prompts" };

const name = "workbot/system";

export default function PromptsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The assistant&apos;s system prompt, versioned. Traffic splits between
        versions by share; a person always gets the same one.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Versions />
      </Suspense>
    </>
  );
}

async function Versions() {
  await requireUser();
  // Reading seeds version 1 from the code the first time.
  await promptOf(name, "admin", systemPrompt);
  const rows = await versions(name);
  return (
    <>
      <SplitForm
        name={name}
        rows={rows.map((row) => ({
          version: row.version,
          share: row.share,
          text: row.text,
          label: `${row.note || "no note"} · ${row.createdAt.toLocaleDateString(
            "en-GB",
            { dateStyle: "medium" },
          )}`,
        }))}
      />
      <VersionForm name={name} initialText={rows[0]?.text} />
    </>
  );
}
