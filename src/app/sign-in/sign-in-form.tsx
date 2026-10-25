"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

/** The key goes to the server once; the browser keeps a session cookie, never the key. */
export function SignInForm({ next }: { next?: string }) {
  const [error, act, pending] = useActionState(signIn, undefined);
  return (
    <form action={act} className="mt-8 grid gap-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <Label htmlFor="key">Key</Label>
      <Input
        id="key"
        name="key"
        type="password"
        autoComplete="off"
        placeholder="wb_…"
        required
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2">
        <KeyRound />
        {pending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
