"use client";

import * as React from "react";
import type { Category, RecurringTransaction } from "@prisma/client";
import { CalendarClock, CheckCircle2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { RecurringDialog } from "./recurring-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { RECURRENCE_LABELS, PAYMENT_MODE_LABELS } from "@/lib/constants";
import { deleteRecurring, markRecurringPaid } from "@/lib/actions/recurring";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function MarkPaidButton({ id }: { id: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markRecurringPaid(id);
          if (!result.success) toast.error(result.error ?? "Couldn't mark as paid.");
          else toast.success("Logged as a transaction and rolled forward.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark Paid
    </Button>
  );
}

export function RecurringList({ items, categories }: { items: RecurringTransaction[]; categories: Category[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No recurring items yet"
        description="Add bills, subscriptions or EMIs so you never miss a due date."
        action={<RecurringDialog categories={categories} />}
      />
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-3">
      {items.map((r) => {
        const due = new Date(r.nextDueDate);
        const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        const overdue = daysLeft < 0 && r.isActive;

        return (
          <div key={r.id} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between", !r.isActive && "opacity-60")}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{r.name}</p>
                <Badge variant="secondary">{RECURRENCE_LABELS[r.frequency]}</Badge>
                {!r.isActive && <Badge variant="outline">Inactive</Badge>}
                {overdue && <Badge variant="destructive">Overdue</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Next due {formatDate(r.nextDueDate)} · {PAYMENT_MODE_LABELS[r.paymentMode]}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("text-lg font-semibold tabular-nums", r.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "")}>
                {formatCurrency(r.amount)}
              </span>
              <div className="flex items-center gap-1">
                {r.isActive && <MarkPaidButton id={r.id} />}
                <RecurringDialog
                  item={r}
                  categories={categories}
                  trigger={<Button variant="ghost" size="icon-sm" aria-label="Edit"><Pencil className="size-4" /></Button>}
                />
                <DeleteButton itemLabel="recurring item" onDelete={() => deleteRecurring(r.id)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
