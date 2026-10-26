import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { SheetQuestion } from "@/components/sheet-question";
import { SheetTotals } from "@/components/sheet-totals";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { when } from "@/lib/format";
import { getSheet } from "@/lib/sheets";
import { askSheet } from "../actions";

// A question is a few model calls and queries; the action waits for all of them.
export const maxDuration = 120;

export default function SheetPage(props: PageProps<"/admin/sheets/[id]">) {
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2.5">
        <Link href="/admin/sheets">
          <ArrowLeft /> Sheets
        </Link>
      </Button>
      <Suspense
        fallback={
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <SheetDetail params={props.params} />
      </Suspense>
    </>
  );
}

async function SheetDetail({
  params,
}: Pick<PageProps<"/admin/sheets/[id]">, "params">) {
  await requireUser();
  const { id } = await params;
  const sheet = z.uuid().safeParse(id).success ? await getSheet(id) : undefined;
  if (!sheet) notFound();
  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {sheet.name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {sheet.rows.toLocaleString("en-US")} rows, uploaded{" "}
        {when(sheet.createdAt)}. The model sees the columns and three rows;
        every figure in an answer comes from a query below it.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <SheetTotals totals={sheet.totals} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-xs">
          {sheet.columns.map((column) => (
            <li key={column.name} title={column.header}>
              {column.name}{" "}
              <span className="text-muted-foreground">
                {column.type.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <SheetQuestion action={askSheet.bind(null, sheet.id)} />
    </>
  );
}
