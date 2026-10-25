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
import { statusLabels, type WorkRequest } from "@/lib/requests";

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

export function RequestList({ requests }: { requests: WorkRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">No requests yet.</p>;
  }
  return (
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
  );
}
