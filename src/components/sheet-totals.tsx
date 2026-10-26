import { Badge } from "@/components/ui/badge";
import { type Total, reconciles } from "@/lib/sheets";

const figure = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** The sheet's own totals row, figure by figure, against the sum of the rows WorkBot loaded. */
export function SheetTotals({ totals }: { totals: Total[] }) {
  if (totals.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No totals row to check the rows against.
      </p>
    );
  return (
    <ul className="flex flex-wrap gap-2">
      {totals.map((total) => (
        <li key={total.column}>
          <Badge variant={reconciles(total) ? "secondary" : "destructive"}>
            {total.column}: {figure.format(total.stated)}
            {reconciles(total)
              ? " reconciles"
              : ` stated, ${figure.format(total.summed)} summed`}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
