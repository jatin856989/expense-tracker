import Link from "next/link";
import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { filterByMonth } from "@/lib/queries";
import { formatCurrency, monthLabel } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { BudgetDialog } from "@/components/budgets/budget-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/shared/delete-button";
import { deleteBudget } from "@/lib/actions/budgets";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  const sp = await searchParams;
  const now = new Date();
  const month = Number(sp.month) || now.getMonth() + 1;
  const year = Number(sp.year) || now.getFullYear();

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const monthStart = new Date(year, month - 1, 1);

  // Spend is only ever tallied for the selected month, so scope the query
  // to it instead of pulling every expense the account has ever logged.
  const [budgets, expenseCategories, transactions] = await Promise.all([
    prisma.budget.findMany({ where: { month, year }, include: { category: true }, orderBy: { limit: "desc" } }),
    prisma.category.findMany({ where: { kind: "EXPENSE" }, orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ where: { type: "EXPENSE", date: { gte: monthStart, lt: nextDate } } }),
  ]);

  const monthTx = filterByMonth(transactions, month, year);
  const spendByCategory = new Map<string, number>();
  for (const t of monthTx) {
    if (!t.categoryId) continue;
    spendByCategory.set(t.categoryId, (spendByCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId));
  const availableCategories = expenseCategories.filter((c) => !budgetedCategoryIds.has(c.id));

  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpend = budgets.reduce((s, b) => s + (spendByCategory.get(b.categoryId) ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Set monthly spending limits per category and track progress."
        actions={availableCategories.length > 0 ? <BudgetDialog categories={availableCategories} month={month} year={year} /> : undefined}
      />

      <div className="flex items-center justify-between rounded-xl border bg-card p-4">
        <Button nativeButton={false} variant="ghost" size="icon" render={<Link href={`/budgets?month=${prevDate.getMonth() + 1}&year=${prevDate.getFullYear()}`} />} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="font-semibold">{monthLabel(month, year)}</p>
          {totalLimit > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalSpend)} of {formatCurrency(totalLimit)} spent
            </p>
          )}
        </div>
        <Button nativeButton={false} variant="ghost" size="icon" render={<Link href={`/budgets?month=${nextDate.getMonth() + 1}&year=${nextDate.getFullYear()}`} />} aria-label="Next month">
          <ChevronRight />
        </Button>
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No budgets set for this month"
          description="Set a spending limit for a category to start tracking progress."
          action={availableCategories.length > 0 ? <BudgetDialog categories={availableCategories} month={month} year={year} /> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => {
            const spend = spendByCategory.get(b.categoryId) ?? 0;
            const percent = b.limit > 0 ? (spend / b.limit) * 100 : 0;
            const over = percent > 100;
            return (
              <div key={b.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: b.category.color ?? "#64748b" }} />
                    <span className="font-medium">{b.category.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BudgetDialog
                      categories={expenseCategories}
                      month={month}
                      year={year}
                      categoryId={b.categoryId}
                      existingLimit={b.limit}
                      trigger={<Button variant="ghost" size="sm">Edit</Button>}
                    />
                    <DeleteButton itemLabel="budget" onDelete={deleteBudget.bind(null, b.id)} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span className={cn("font-semibold tabular-nums", over && "text-red-600 dark:text-red-400")}>
                    {formatCurrency(spend)}
                  </span>
                  <span className="text-muted-foreground">of {formatCurrency(b.limit)}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : percent > 80 ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{percent.toFixed(0)}% used</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
