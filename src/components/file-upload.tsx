"use client";

import { Film } from "lucide-react";
import { useRef } from "react";
import { PendingButton } from "@/components/pending-button";

type Props = { action: (formData: FormData) => Promise<void> };

/** One button: pick a recording, and the form submits itself. */
export function RecordingUpload({ action }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={action}>
      <input
        ref={file}
        type="file"
        name="recording"
        accept="video/*"
        aria-label="Recording"
        className="sr-only"
        onChange={() => form.current?.requestSubmit()}
      />
      <PendingButton
        type="button"
        busy="Reading the recording…"
        icon={<Film />}
        onClick={() => file.current?.click()}
      >
        Attach a recording
      </PendingButton>
    </form>
  );
}
