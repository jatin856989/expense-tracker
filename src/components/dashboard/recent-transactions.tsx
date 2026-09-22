import Link from "next/link";
import type { Category, Transaction } from "@prisma/client";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Receipt } from "lucide-react";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type TxWithCategory = Transaction & { category: Category | null };

export function RecentTransactions({ transactions }: { transactions: TxWithCategory[] }) {
  if (transactions.length === 0) {
    return <EmptyState icon={Receipt} title="No transactions yet" description="Transactions you log will show up here." />;
  }

  return (
    <div className="divide-y">
      {transactions.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${t.category?.color ?? "#64748b"}18`,
                color: t.category?.color ?? "#64748b",
              }}
            >
              {t.type === "TRANSFER" ? (
                <ArrowLeftRight className="size-4" />
              ) : (
                <DynamicIcon iconName={t.category?.icon} className="size-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.category?.name ?? "Uncategorized"} · {formatDate(t.date)}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums",
              t.type === "INCOME" && "text-emerald-600 dark:text-emerald-400",
              t.type === "EXPENSE" && "text-red-600 dark:text-red-400"
            )}
          >
            {t.type === "INCOME" && <ArrowDownLeft className="size-3.5" />}
            {t.type === "EXPENSE" && <ArrowUpRight className="size-3.5" />}
            {t.type === "EXPENSE" ? "-" : t.type === "INCOME" ? "+" : ""}
            {formatCurrency(t.amount)}
          </div>
        </div>
      ))}
      <div className="pt-3 text-center">
        <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">
          View all transactions →
        </Link>
      </div>
    </div>
  );
}
