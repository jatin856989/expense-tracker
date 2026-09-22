import Link from "next/link";
import type { RecurringTransaction } from "@prisma/client";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function UpcomingList({ items }: { items: RecurringTransaction[] }) {
  if (items.length === 0) {
    return <EmptyState icon={CalendarClock} title="Nothing due soon" description="Recurring bills and subscriptions will show up here." />;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="divide-y">
      {items.map((r) => {
        const due = new Date(r.nextDueDate);
        const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        const overdue = daysLeft < 0;
        return (
          <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(r.nextDueDate)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={overdue ? "destructive" : daysLeft <= 3 ? "outline" : "secondary"}>
                {overdue ? "Overdue" : daysLeft === 0 ? "Today" : `${daysLeft}d`}
              </Badge>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.amount)}</span>
            </div>
          </div>
        );
      })}
      <div className="pt-3 text-center">
        <Link href="/recurring" className="text-xs font-medium text-primary hover:underline">
          Manage recurring items →
        </Link>
      </div>
    </div>
  );
}
