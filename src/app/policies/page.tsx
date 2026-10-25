import type { Metadata } from "next";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPolicies } from "@/lib/policies";

export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const policies = await listPolicies();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The rules the company runs on, each owned by a team.
      </p>
      <Table className="mt-8">
        <TableHeader>
          <TableRow>
            <TableHead>Policy</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.map((policy) => (
            <TableRow key={policy.slug}>
              <TableCell className="font-medium">
                <Link
                  href={`/policies/${policy.slug}`}
                  className="hover:underline"
                >
                  {policy.title}
                </Link>
              </TableCell>
              <TableCell>{policy.owner}</TableCell>
              <TableCell className="text-muted-foreground">
                {policy.updated}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
