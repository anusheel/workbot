"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Where the code can be sent from: a label, and a link with {code} where the code goes. */
export type LinkTarget = { label: string; href?: string };

type Props = {
  label: string;
  icon: ReactNode;
  instruction: string;
  targets: LinkTarget[];
  action: () => Promise<string>;
};

/**
 * A one-time code for linking another channel to this person, shown with
 * the message to send and links that open the channel with it typed in.
 */
export function LinkCode({ label, icon, instruction, targets, action }: Props) {
  const [code, setCode] = useState<string>();
  const [pending, start] = useTransition();
  const message = code && `link ${code}`;
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() => start(async () => setCode(await action()))}
      >
        {pending ? <Loader2 className="animate-spin" /> : icon}
        {label}
      </Button>
      {message && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="text-muted-foreground">{instruction}</p>
          <p className="mt-2 font-mono text-base tracking-wide">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {targets.map(({ label, href }) =>
              href ? (
                <Button key={label} asChild variant="secondary" size="sm">
                  <a href={href.replace("{code}", encodeURIComponent(message))}>
                    {label}
                  </a>
                </Button>
              ) : (
                <span key={label} className="text-muted-foreground">
                  {label}
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
