"use client";

import { Loader2, Search } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = { action: () => Promise<void>; again: boolean };

/** Starts the analyst and shows that it is running: a run takes a minute or more. */
export function InvestigateButton({ action, again }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button formAction={action} variant="outline" size="sm" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Search />}
      {pending ? "Investigating…" : again ? "Investigate again" : "Investigate"}
    </Button>
  );
}
