"use client";

import { Plug } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connect } from "./actions";

export function ConnectGitHub() {
  const [error, act, pending] = useActionState(connect, undefined);
  return (
    <form action={act} className="grid gap-2">
      <div className="flex gap-2">
        <Input
          name="token"
          type="password"
          autoComplete="off"
          aria-label="GitHub token"
          placeholder="A GitHub token with access to the ticketing repository"
          required
        />
        <Button type="submit" variant="outline" disabled={pending}>
          <Plug />
          {pending ? "Sealing…" : "Connect"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
