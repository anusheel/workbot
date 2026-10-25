"use client";

import { type ReactNode, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { submitRequest } from "../actions";

type Props = { teams: readonly string[]; priorities: readonly string[] };

export function RequestForm({ teams, priorities }: Props) {
  const [state, action, pending] = useActionState(submitRequest, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Title" errors={state.errors?.title}>
        <Input name="title" required maxLength={120} />
      </Field>
      <Field label="Details" errors={state.errors?.body}>
        <Textarea name="body" rows={5} maxLength={5000} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Team" errors={state.errors?.team}>
          <NativeSelect name="team" className="w-full">
            {teams.map((team) => (
              <NativeSelectOption key={team} value={team}>
                {team}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Priority" errors={state.errors?.priority}>
          <NativeSelect
            name="priority"
            defaultValue="normal"
            className="w-full"
          >
            {priorities.map((priority) => (
              <NativeSelectOption key={priority} value={priority}>
                {priority}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}

function Field({
  label,
  errors,
  children,
}: {
  label: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        {children}
      </Label>
      {errors && (
        <p className="text-sm text-destructive">{errors.join(". ")}</p>
      )}
    </div>
  );
}
