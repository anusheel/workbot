import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Status, statusLabels, statuses } from "@/lib/request-model";

export function StatusCounts({
  byStatus,
}: {
  byStatus: Record<Status, number>;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {statuses.map((status) => (
        <Link key={status} href={`/requests?status=${status}`}>
          <Card>
            <CardHeader>
              <CardDescription>{statusLabels[status]}</CardDescription>
              <CardTitle className="text-3xl">{byStatus[status]}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
