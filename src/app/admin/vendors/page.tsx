// Generated from content/entities/vendor.json by pnpm generate. Edit the description, not this file.
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PendingButton } from "@/components/pending-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { when } from "@/lib/format";
import { listVendors, vendorTerms } from "@/lib/entities/vendor";
import { createVendorAction } from "./actions";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
      <form
        action={createVendorAction}
        className="mt-6 grid gap-4 sm:grid-cols-2"
      >
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required type="text" maxLength={120} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="terms">Payment terms</Label>
          <NativeSelect id="terms" name="terms" defaultValue={"net 30"}>
            {vendorTerms.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} maxLength={2000} />
        </div>
        <div className="sm:col-span-2">
          <PendingButton busy="Saving…" icon={<Plus />}>
            Add vendor
          </PendingButton>
        </div>
      </form>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Vendors />
      </Suspense>
    </>
  );
}

async function Vendors() {
  await requireUser();
  const rows = await listVendors();
  const now = new Date();
  return (
    <div className="mt-8 rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Payment terms</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No vendors yet
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-xs whitespace-normal">
                {row.name}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.email ?? "–"}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.phone ?? "–"}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.terms}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.notes ?? "–"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {when(row.createdAt, now)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
