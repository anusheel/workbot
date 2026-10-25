"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = ComponentProps<typeof Button> & { busy: string; icon: ReactNode };

/** A button in a form that shows while the form's submission runs: a run can take a minute or more. */
export function PendingButton({ busy, icon, children, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      variant="outline"
      size="sm"
      {...props}
      disabled={pending || props.disabled}
    >
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {pending ? busy : children}
    </Button>
  );
}
