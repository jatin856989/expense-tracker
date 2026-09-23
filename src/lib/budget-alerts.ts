import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { getOrCreateMonthlyBudgetGoal } from "@/lib/actions/monthly-budget";

/**
 * Shared budget-threshold logic used both right after a new expense is
 * logged (transactions, recurring "mark paid", voice entry, pending-payment
 * confirmation) and for the dashboard's passive summary — so a category (or
 * the overall monthly total) crossing its limit is surfaced immediately,
 * not just the next time someone happens to open the Budgets page.
 */

export const BUDGET_NEAR_THRESHOLD = 80;

export type BudgetAlert = {
  kind: "category" | "overall";
  categoryId: string | null;
  categoryName: string; // for "overall", a fixed display label
  limit: number;
  spend: number;
  percent: number;
  severity: "over" | "near";
};

function toAlert(
  kind: BudgetAlert["kind"],
  categoryId: string | null,
  categoryName: string,
  limit: number,
  spend: number
): BudgetAlert | null {
  const percent = limit > 0 ? (spend / limit) * 100 : 0;
  if (percent < BUDGET_NEAR_THRESHOLD) return null;
  return { kind, categoryId, categoryName, limit, spend, percent, severity: percent >= 100 ? "over" : "near" };
}

async function totalExpenseSpend(month: number, year: number): Promise<number> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const agg = await prisma.transaction.aggregate({
    where: { type: "EXPENSE", date: { gte: monthStart, lt: monthEnd } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** Checks the single category a just-logged expense belongs to, plus the overall monthly total. Used right after creating/updating a transaction. */
export async function checkAllBudgetAlerts(categoryId: string | null, date: Date): Promise<BudgetAlert[]> {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const alerts: BudgetAlert[] = [];

  if (categoryId) {
    const budget = await prisma.budget.findUnique({
      where: { categoryId_month_year: { categoryId, month, year } },
      include: { category: true },
    });
    if (budget) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);
      const agg = await prisma.transaction.aggregate({
        where: { type: "EXPENSE", categoryId, date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      });
      const alert = toAlert("category", categoryId, budget.category.name, budget.limit, agg._sum.amount ?? 0);
      if (alert) alerts.push(alert);
    }
  }

  const overallGoal = await getOrCreateMonthlyBudgetGoal(month, year);
  if (overallGoal) {
    const spend = await totalExpenseSpend(month, year);
    const alert = toAlert("overall", null, "Overall Monthly Budget", overallGoal.limit, spend);
    if (alert) alerts.push(alert);
  }

  return alerts;
}

/** Every category (and the overall total) at/over threshold for the current month. Used for the dashboard's passive summary. */
export async function getCurrentMonthBudgetAlerts(): Promise<BudgetAlert[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [budgets, transactions, overallGoal] = await Promise.all([
    prisma.budget.findMany({ where: { month, year }, include: { category: true } }),
    prisma.transaction.findMany({
      where: { type: "EXPENSE", date: { gte: monthStart, lt: monthEnd } },
      select: { categoryId: true, amount: true },
    }),
    getOrCreateMonthlyBudgetGoal(month, year),
  ]);

  const spendByCategory = new Map<string, number>();
  let totalSpend = 0;
  for (const t of transactions) {
    totalSpend += t.amount;
    if (!t.categoryId) continue;
    spendByCategory.set(t.categoryId, (spendByCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  const alerts: BudgetAlert[] = [];
  for (const b of budgets) {
    const alert = toAlert("category", b.categoryId, b.category.name, b.limit, spendByCategory.get(b.categoryId) ?? 0);
    if (alert) alerts.push(alert);
  }
  if (overallGoal) {
    const alert = toAlert("overall", null, "Overall Monthly Budget", overallGoal.limit, totalSpend);
    if (alert) alerts.push(alert);
  }

  return alerts.sort((a, b) => b.percent - a.percent);
}

export function formatBudgetAlert(alert: BudgetAlert): string {
  const pct = Math.round(alert.percent);
  const spent = `${formatCurrency(alert.spend)} of ${formatCurrency(alert.limit)}`;
  const label = alert.kind === "overall" ? alert.categoryName : `${alert.categoryName} budget`;
  return alert.severity === "over"
    ? `${label} exceeded — ${pct}% used (${spent}).`
    : `${label} at ${pct}% (${spent}).`;
}
