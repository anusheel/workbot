"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type SplitState,
  type VersionState,
  createVersion,
  splitTraffic,
} from "./actions";

type Row = {
  version: number;
  share: number;
  text: string;
  label: string;
};

export function SplitForm({
  name,
  rows,
  readOnly = false,
}: {
  name: string;
  rows: Row[];
  // For a role that may read the versions but not change their traffic.
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState<SplitState, FormData>(
    splitTraffic.bind(null, name),
    {},
  );
  const [typed, setTyped] = useState<Record<number, string>>({});
  const value = (row: Row) =>
    typed[row.version] ?? state.shares?.[row.version] ?? String(row.share);
  const total = rows.reduce((sum, row) => sum + (Number(value(row)) || 0), 0);
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.version} className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant={row.share > 0 ? "default" : "outline"}>
                v{row.version}
              </Badge>
              <span className="text-sm text-muted-foreground">{row.label}</span>
            </div>
            <Label className="flex items-center gap-2 text-sm">
              Share
              <Input
                name={`share-${row.version}`}
                type="number"
                min={0}
                max={100}
                value={value(row)}
                disabled={readOnly}
                onChange={(event) =>
                  setTyped((prev) => ({
                    ...prev,
                    [row.version]: event.target.value,
                  }))
                }
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
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" disabled={pending}>
            Save the split
          </Button>
          <span className="text-sm text-muted-foreground">Total {total}%</span>
          {state.message && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

export function VersionForm({
  name,
  initialText,
}: {
  name: string;
  initialText?: string;
}) {
  const [state, action, pending] = useActionState<VersionState, FormData>(
    createVersion,
    {},
  );
  return (
    <form action={action} className="mt-10 flex flex-col gap-4">
      <input type="hidden" name="name" value={name} />
      <h2 className="text-base font-semibold">New version</h2>
      <Label className="flex flex-col gap-2">
        Note
        <Input
          name="note"
          maxLength={200}
          defaultValue={state.note}
          placeholder="what changed, in a few words"
        />
        {state.errors?.note && (
          <span className="text-sm text-destructive">
            {state.errors.note[0]}
          </span>
        )}
      </Label>
      <Label className="flex flex-col gap-2">
        Prompt
        <Textarea
          name="text"
          rows={10}
          minLength={20}
          defaultValue={state.text ?? initialText}
        />
        {state.errors?.text && (
          <span className="text-sm text-destructive">
            {state.errors.text[0]}
          </span>
        )}
      </Label>
      <Button type="submit" disabled={pending} className="self-start">
        Add version
      </Button>
    </form>
  );
}
