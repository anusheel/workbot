"use client";

import { KeyRound, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { roles } from "@/lib/auth-model";
import { type Issued, addKey, addUser } from "./actions";

/** A key, shown once: whoever it is for copies it now. */
function Shown({ issued }: { issued: Issued }) {
  if (issued.error)
    return <p className="text-sm text-destructive">{issued.error}</p>;
  if (!issued.key) return null;
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <p>
        The key for <strong>{issued.name}</strong>, shown this once:
      </p>
      <code className="mt-2 block font-mono text-xs break-all select-all">
        {issued.key}
      </code>
    </div>
  );
}

export function AddUser() {
  const [issued, act, pending] = useActionState(addUser, {});
  return (
    <form
      action={act}
      className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="A person, or a service"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="role">Role</Label>
        <NativeSelect id="role" name="role" defaultValue="viewer">
          {roles.map((role) => (
            <NativeSelectOption key={role} value={role}>
              {role}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        <UserPlus />
        {pending ? "Adding…" : "Add"}
      </Button>
      <div className="sm:col-span-3">
        <Shown issued={issued} />
      </div>
    </form>
  );
}

export function AddKey({ userId, name }: { userId: string; name: string }) {
  const [issued, setIssued] = useState<Issued>({});
  const [pending, setPending] = useState(false);
  return (
    <div className="grid gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setIssued(await addKey(userId, name));
          setPending(false);
        }}
      >
        <KeyRound />
        New key
      </Button>
      <Shown issued={issued} />
    </div>
  );
}
