import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InboxItem, InboxStatus as Status } from "@/lib/inbox";

const statusLabels: Record<
  Status,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  received: { label: "Extracting", variant: "secondary" },
  extracted: { label: "Checking", variant: "secondary" },
  awaiting_review: { label: "Needs review", variant: "outline" },
  stored: { label: "Filed", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

export function InboxStatus({
  item,
  review,
}: {
  item: InboxItem;
  // Absent for a role that may not review: the status shows, the buttons do not.
  review?: (id: string, decision: string) => Promise<void>;
}) {
  const { label, variant } = statusLabels[item.status];
  if (item.status === "failed")
    return (
      <span className="flex items-center gap-2">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-muted-foreground">{item.review.join(", ")}</span>
      </span>
    );
  if (item.status !== "awaiting_review" || !review)
    return <Badge variant={variant}>{label}</Badge>;
  return (
    <form className="flex items-center gap-2">
      <Badge variant={variant}>{label}</Badge>
      <Button
        size="sm"
        aria-label={`Approve ${item.name}`}
        formAction={review.bind(null, item.id, "approved")}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        aria-label={`Reject ${item.name}`}
        formAction={review.bind(null, item.id, "rejected")}
      >
        Reject
      </Button>
    </form>
  );
}
