import { Check } from "lucide-react";
import { PendingButton } from "@/components/pending-button";
import { type Status, statusLabels, statuses } from "@/lib/request-model";

/** One form per next status, so a click disables only its own button and cannot send twice. */
export function StatusActions({
  id,
  status,
  action,
}: {
  id: string;
  status: Status;
  action: (id: string, status: Status) => Promise<void>;
}) {
  return (
    <div role="group" aria-label="Change status" className="mt-8 flex gap-2">
      {statuses
        .filter((next) => next !== status)
        .map((next) => (
          <form key={next} action={action.bind(null, id, next)}>
            <PendingButton busy="Saving…" icon={<Check />}>
              Mark {statusLabels[next].toLowerCase()}
            </PendingButton>
          </form>
        ))}
    </div>
  );
}
