"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Answer = { question?: string; answer?: string };
type Props = { action: (state: Answer, formData: FormData) => Promise<Answer> };

/** A question about a recording, answered from what its frames showed. */
export function RecordingQuestion({ action }: Props) {
  const [state, act, pending] = useActionState(action, {});
  return (
    <form action={act} className="mt-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          name="question"
          aria-label="Question"
          placeholder="Ask about this recording"
          required
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Asking…" : "Ask"}
        </Button>
      </div>
      {state.answer && (
        <p className="text-sm leading-relaxed">
          <span className="text-muted-foreground">{state.question}</span>
          <br />
          {state.answer}
        </p>
      )}
    </form>
  );
}
