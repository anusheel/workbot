import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { promptOf, versions } from "@/lib/prompts";
import { systemPrompt } from "@/lib/system-prompt";
import { createVersion, splitTraffic } from "./actions";

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
  // Reading seeds version 1 from the code the first time.
  await promptOf(name, "admin", systemPrompt);
  const rows = await versions(name);
  return (
    <>
      <form
        action={splitTraffic.bind(null, name)}
        className="mt-8 flex flex-col gap-4"
      >
        {rows.map((row) => (
          <div key={row.version} className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={row.share > 0 ? "default" : "outline"}>
                  v{row.version}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {row.note || "no note"} ·{" "}
                  {row.createdAt.toLocaleDateString("en-GB", {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
              <Label className="flex items-center gap-2 text-sm">
                Share
                <Input
                  name={`share-${row.version}`}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={row.share}
                  className="w-20"
                />
                %
              </Label>
            </div>
            <pre className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">
              {row.text}
            </pre>
          </div>
        ))}
        <Button type="submit" variant="outline" className="self-start">
          Save the split
        </Button>
      </form>
      <form action={createVersion} className="mt-10 flex flex-col gap-4">
        <input type="hidden" name="name" value={name} />
        <h2 className="text-base font-semibold">New version</h2>
        <Label className="flex flex-col gap-2">
          Note
          <Input name="note" placeholder="what changed, in a few words" />
        </Label>
        <Label className="flex flex-col gap-2">
          Prompt
          <Textarea name="text" rows={10} defaultValue={rows[0]?.text} />
        </Label>
        <Button type="submit" className="self-start">
          Add version
        </Button>
      </form>
    </>
  );
}
