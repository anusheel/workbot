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
  multiple?: boolean;
};

/** One button: pick a file, or several, and the form submits itself. */
export function FileUpload({
  action,
  name,
  accept,
  label,
  busy,
  icon,
  multiple = false,
}: Props) {
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={action}>
      <input
        ref={file}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
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
