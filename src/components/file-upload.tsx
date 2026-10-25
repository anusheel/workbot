"use client";

import { type ReactNode, useRef } from "react";
import { PendingButton } from "@/components/pending-button";

type Props = {
  action: (formData: FormData) => Promise<void>;
  name: string;
  accept: string;
  label: string;
  busy: string;
  icon: ReactNode;
};

/** One button: pick a file, and the form submits itself. */
export function FileUpload({ action, name, accept, label, busy, icon }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={action}>
      <input
        ref={file}
        type="file"
        name={name}
        accept={accept}
        aria-label={label}
        className="sr-only"
        onChange={() => form.current?.requestSubmit()}
      />
      <PendingButton
        type="button"
        busy={busy}
        icon={icon}
        onClick={() => file.current?.click()}
      >
        {label}
      </PendingButton>
    </form>
  );
}
