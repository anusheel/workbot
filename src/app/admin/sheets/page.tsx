import { Sheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Allowed } from "@/components/allowed";
import { FileUpload } from "@/components/file-upload";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { when } from "@/lib/format";
import { listSheets, reconciles } from "@/lib/sheets";
import { uploadSheet } from "./actions";

export const metadata: Metadata = { title: "Sheets" };

export default function SheetsPage() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sheets</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Spreadsheets too large for a prompt. Each one loads into a database
            of its own; a question is answered by SQL, shown with its results.
          </p>
        </div>
        <Suspense>
          <Allowed role="agent">
            <FileUpload
              action={uploadSheet}
              name="sheet"
              accept=".xlsx"
              label="Upload a workbook"
              busy="Reading…"
              icon={<Sheet />}
            />
          </Allowed>
        </Suspense>
      </div>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Sheets />
      </Suspense>
    </>
  );
}

async function Sheets() {
  await requireUser();
  const sheets = await listSheets();
  if (sheets.length === 0)
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        No sheets yet. An agent can upload an Excel workbook (.xlsx); its first
        worksheet is the table.
      </p>
    );
  return (
    <div className="mt-8 rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sheet</TableHead>
            <TableHead className="text-right">Rows</TableHead>
            <TableHead className="text-right">Columns</TableHead>
            <TableHead>Totals</TableHead>
            <TableHead className="text-right">Uploaded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sheets.map((sheet) => {
            const off = sheet.totals.filter((t) => !reconciles(t)).length;
            return (
              <TableRow key={sheet.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/sheets/${sheet.id}`}
                    className="underline underline-offset-4"
                  >
                    {sheet.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {sheet.rows.toLocaleString("en-US")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {sheet.columns.length}
                </TableCell>
                <TableCell>
                  {sheet.totals.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : off ? (
                    <Badge variant="destructive">{off} off</Badge>
                  ) : (
                    <Badge variant="secondary">Reconcile</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {when(sheet.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
