import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { statusLabels, type WorkRequest } from "@/lib/request-model";

const priorityTone = {
  low: "outline",
  normal: "secondary",
  high: "destructive",
} as const;
const statusTone = {
  open: "default",
  in_progress: "secondary",
  done: "outline",
} as const;

export function RequestList({
  requests,
  filtered = false,
}: {
  requests: WorkRequest[];
  filtered?: boolean;
}) {
  if (requests.length === 0) {
    return filtered ? (
      <p className="text-sm text-muted-foreground">
        No requests match these filters.{" "}
        <Link href="/requests" className="underline">
          Clear filters
        </Link>
      </p>
    ) : (
      <p className="text-sm text-muted-foreground">No requests yet.</p>
    );
  }
  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground">
        {requests.length} {requests.length === 1 ? "request" : "requests"}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/requests/${request.id}`}
                  className="hover:underline"
                >
                  {request.title}
                </Link>
              </TableCell>
              <TableCell className="capitalize">{request.team}</TableCell>
              <TableCell>
                <Badge
                  variant={priorityTone[request.priority]}
                  className="capitalize"
                >
                  {request.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={statusTone[request.status]}>
                  {statusLabels[request.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
