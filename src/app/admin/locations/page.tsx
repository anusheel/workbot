// Generated from content/entities/location.json by pnpm generate. Edit the description, not this file.
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
import { listLocations, locationKind } from "@/lib/entities/location";
import { createLocationAction } from "./actions";

export const metadata: Metadata = { title: "Locations" };

export default function LocationsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
      <form
        action={createLocationAction}
        className="mt-6 grid gap-4 sm:grid-cols-2"
      >
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required type="text" maxLength={80} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            name="address"
            required
            rows={3}
            maxLength={200}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="manager">Manager</Label>
          <Input id="manager" name="manager" type="text" maxLength={80} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="kind">Kind</Label>
          <NativeSelect id="kind" name="kind" defaultValue={"warehouse"}>
            {locationKind.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <PendingButton busy="Saving…" icon={<Plus />}>
            Add location
          </PendingButton>
        </div>
      </form>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Locations />
      </Suspense>
    </>
  );
}

async function Locations() {
  await requireUser();
  const rows = await listLocations();
  const now = new Date();
  return (
    <div className="mt-8 rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Kind</TableHead>
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
                No locations yet
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-xs whitespace-normal">
                {row.name}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.address}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.manager ?? "–"}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.phone ?? "–"}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {row.kind}
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
