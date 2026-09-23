import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, HandCoins, Landmark, TriangleAlertIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getFinanceSnapshot, filterByMonth, last6MonthsKeys } from "@/lib/queries";
import { computeInvestmentGain, computeNetLoanBalances } from "@/lib/calculations";
import { getCurrentMonthBudgetAlerts } from "@/lib/budget-alerts";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { CategoryBreakdownChart, type CategorySlice } from "@/components/dashboard/category-breakdown-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { UpcomingList } from "@/components/dashboard/upcoming-list";
import { PendingPaymentsBanner } from "@/components/dashboard/pending-payments-banner";
import { NetBalanceList } from "@/components/loans/net-balance-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [snapshot, recurring, recentTx, allCategories, budgetAlerts, pendingTransactions, activeCards, activeAccounts] = await Promise.all([
    getFinanceSnapshot(),
    prisma.recurringTransaction.findMany({
      where: { isActive: true },
      orderBy: { nextDueDate: "asc" },
      take: 5,
    }),
    prisma.transaction.findMany({
      orderBy: { date: "desc" },
      take: 8,
      include: { category: true },
    }),
    prisma.category.findMany(),
    getCurrentMonthBudgetAlerts(),
    prisma.pendingTransaction.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.card.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));

  const now = new Date();
  const thisMonth = filterByMonth(snapshot.transactions, now.getMonth() + 1, now.getFullYear());
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = filterByMonth(snapshot.transactions, lastMonthDate.getMonth() + 1, lastMonthDate.getFullYear());

  const thisMonthExpense = thisMonth.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const thisMonthIncome = thisMonth.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const lastMonthExpense = lastMonth.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const lastMonthIncome = lastMonth.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);

  const expenseTrend = lastMonthExpense > 0 ? ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;
  const incomeTrend = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;

  // Cash flow trend, last 6 months
  const months = last6MonthsKeys();
  const cashFlowData = months.map(({ month, year, label }) => {
    const items = filterByMonth(snapshot.transactions, month, year);
    return {
      label,
      income: items.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0),
      expense: items.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0),
    };
  });

  // Category breakdown for this month's expenses
  const categoryMap = new Map<string, CategorySlice>();
  for (const t of thisMonth) {
    if (t.type !== "EXPENSE") continue;
    const key = t.categoryId ?? "uncategorized";
    const existing = categoryMap.get(key);
    if (existing) {
      existing.value += t.amount;
    } else {
      categoryMap.set(key, { name: "Uncategorized", value: t.amount, color: "#94a3b8" });
    }
  }
  // fill in real category names/colors (categories were already fetched above, alongside the other queries)
  for (const [id, slice] of categoryMap) {
    const c = categoryById.get(id);
    if (c) {
      slice.name = c.name;
      slice.color = c.color ?? "#64748b";
    }
  }
  const categoryData = [...categoryMap.values()].sort((a, b) => b.value - a.value);

  const investmentGain = snapshot.investments.reduce((s, i) => s + computeInvestmentGain(i).gain, 0);
  const netLoanBalances = computeNetLoanBalances(snapshot.loans);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your complete financial picture, updated in real time."
      />

      <PendingPaymentsBanner
        items={pendingTransactions}
        categories={allCategories}
        cards={activeCards}
        accounts={activeAccounts}
      />

      {budgetAlerts.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />
              Budget Alert{budgetAlerts.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {budgetAlerts.map((a) => (
              <div key={a.categoryId ?? "overall"} className="flex items-center justify-between gap-3 text-sm">
                <span
                  className={cn(
                    "font-medium",
                    a.severity === "over" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {a.severity === "over" ? "Over budget: " : "Near limit: "}
                  {a.categoryName}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCurrency(a.spend)} / {formatCurrency(a.limit)} · {Math.round(a.percent)}%
                </span>
              </div>
            ))}
            <Link href="/budgets" className="inline-block pt-1 text-xs text-primary hover:underline">
              View Budgets →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net Worth" value={formatCurrency(snapshot.netWorth)} icon={Wallet} accent="#3b82f6" index={0} />
        <StatCard
          label="This Month's Expense"
          value={formatCurrency(thisMonthExpense)}
          icon={TrendingDown}
          trend={expenseTrend}
          trendLabel="vs last month"
          accent="#ef4444"
          index={1}
        />
        <StatCard
          label="This Month's Income"
          value={formatCurrency(thisMonthIncome)}
          icon={TrendingUp}
          trend={incomeTrend}
          trendLabel="vs last month"
          accent="#22c55e"
          index={2}
        />
        <StatCard label="Investment Value" value={formatCurrency(snapshot.totalInvestmentValue)} icon={PiggyBank} accent="#8b5cf6" index={3} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bank + Cash Balance" value={formatCurrency(snapshot.totalBankBalance + snapshot.cashBalance)} icon={Landmark} accent="#0ea5e9" index={0} />
        <StatCard label="Investment Gain / Loss" value={formatCurrency(investmentGain)} icon={TrendingUp} accent={investmentGain >= 0 ? "#22c55e" : "#ef4444"} index={1} />
        <StatCard label="Owed to You (Lent)" value={formatCurrency(snapshot.lentOutstanding)} icon={HandCoins} accent="#14b8a6" index={2} />
        <StatCard label="You Owe (Borrowed)" value={formatCurrency(snapshot.borrowedOutstanding)} icon={HandCoins} accent="#f97316" index={3} />
      </div>

      <NetBalanceList balances={netLoanBalances} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={cashFlowData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <UpcomingList items={recurring} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>This Month by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart data={categoryData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactions transactions={recentTx} />
          </CardContent>
        </Card>
      </div>

      {snapshot.accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Accounts Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.accountBalances.map(({ account, balance }) => (
                <Link
                  key={account.id}
                  href={`/accounts/${account.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{account.type}</Badge>
                      {!account.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(balance)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
