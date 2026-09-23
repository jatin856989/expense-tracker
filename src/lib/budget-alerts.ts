import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

/**
 * Shared budget-threshold logic used both right after a new expense is
 * logged (transactions, recurring "mark paid", voice entry) and for the
 * dashboard's passive summary — so a category crossing its limit is
 * surfaced immediately, not just the next time someone happens to open the
 * Budgets page.
 */

export const BUDGET_NEAR_THRESHOLD = 80;

export type BudgetAlert = {
  categoryId: string;
  categoryName: string;
  limit: number;
  spend: number;
  percent: number;
  severity: "over" | "near";
};

function toAlert(categoryId: string, categoryName: string, limit: number, spend: number): BudgetAlert | null {
  const percent = limit > 0 ? (spend / limit) * 100 : 0;
  if (percent < BUDGET_NEAR_THRESHOLD) return null;
  return { categoryId, categoryName, limit, spend, percent, severity: percent >= 100 ? "over" : "near" };
}

/** Checks the single category a just-logged expense belongs to. Used right after creating/updating a transaction. */
export async function checkBudgetAlert(categoryId: string, date: Date): Promise<BudgetAlert | null> {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const budget = await prisma.budget.findUnique({
    where: { categoryId_month_year: { categoryId, month, year } },
    include: { category: true },
  });
  if (!budget) return null;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const agg = await prisma.transaction.aggregate({
    where: { type: "EXPENSE", categoryId, date: { gte: monthStart, lt: monthEnd } },
    _sum: { amount: true },
  });

  return toAlert(categoryId, budget.category.name, budget.limit, agg._sum.amount ?? 0);
}

/** Every category at/over threshold for the current month. Used for the dashboard's passive summary. */
export async function getCurrentMonthBudgetAlerts(): Promise<BudgetAlert[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [budgets, transactions] = await Promise.all([
    prisma.budget.findMany({ where: { month, year }, include: { category: true } }),
    prisma.transaction.findMany({
      where: { type: "EXPENSE", date: { gte: monthStart, lt: monthEnd } },
      select: { categoryId: true, amount: true },
    }),
  ]);

  const spendByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (!t.categoryId) continue;
    spendByCategory.set(t.categoryId, (spendByCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  const alerts: BudgetAlert[] = [];
  for (const b of budgets) {
    const alert = toAlert(b.categoryId, b.category.name, b.limit, spendByCategory.get(b.categoryId) ?? 0);
    if (alert) alerts.push(alert);
  }
  return alerts.sort((a, b) => b.percent - a.percent);
}

export function formatBudgetAlert(alert: BudgetAlert): string {
  const pct = Math.round(alert.percent);
  const spent = `${formatCurrency(alert.spend)} of ${formatCurrency(alert.limit)}`;
  return alert.severity === "over"
    ? `${alert.categoryName} budget exceeded — ${pct}% used (${spent}).`
    : `${alert.categoryName} budget at ${pct}% (${spent}).`;
}
