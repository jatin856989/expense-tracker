import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank, Percent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { filterByMonth, last6MonthsKeys } from "@/lib/queries";
import { computeInvestmentGain, computeLoanOutstanding } from "@/lib/calculations";
import { formatCurrency, monthLabel } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { CategoryBreakdownChart, type CategorySlice } from "@/components/dashboard/category-breakdown-chart";
import { ExportButtons } from "@/components/reports/export-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const now = new Date();
  const month = Number(sp.month) || now.getMonth() + 1;
  const year = Number(sp.year) || now.getFullYear();
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);

  // Every stat on this page only ever looks at the selected month or the 6
  // months of chart data ending on it, so scope the query to that window
  // instead of pulling the account's entire transaction history.
  const months = last6MonthsKeys(new Date(year, month - 1, 1));
  const rangeStart = new Date(months[0].year, months[0].month - 1, 1);
  const rangeEnd = new Date(year, month, 1);

  const [transactions, investments, loans] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: rangeStart, lt: rangeEnd } },
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    prisma.investment.findMany(),
    prisma.loan.findMany({ include: { repayments: true } }),
  ]);

  const monthTx = filterByMonth(transactions, month, year);
  const totalIncome = monthTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const cashFlowData = months.map(({ month: m, year: y, label }) => {
    const items = filterByMonth(transactions, m, y);
    return {
      label,
      income: items.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0),
      expense: items.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0),
    };
  });

  const categoryMap = new Map<string, CategorySlice>();
  for (const t of monthTx) {
    if (t.type !== "EXPENSE") continue;
    const key = t.categoryId ?? "uncategorized";
    const existing = categoryMap.get(key);
    if (existing) existing.value += t.amount;
    else categoryMap.set(key, { name: t.category?.name ?? "Uncategorized", value: t.amount, color: t.category?.color ?? "#94a3b8" });
  }
  const categoryData = [...categoryMap.values()].sort((a, b) => b.value - a.value);

  const totalInvestmentValue = investments.reduce((s, i) => s + computeInvestmentGain(i).current, 0);
  const totalInvested = investments.reduce((s, i) => s + i.amountInvested, 0);
  const investmentGain = totalInvestmentValue - totalInvested;

  const lentOutstanding = loans.filter((l) => l.type === "LENT").reduce((s, l) => s + computeLoanOutstanding(l, l.repayments), 0);
  const borrowedOutstanding = loans.filter((l) => l.type === "BORROWED").reduce((s, l) => s + computeLoanOutstanding(l, l.repayments), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Interactive monthly reports across every module, with Excel and PDF export."
        actions={<ExportButtons month={month} year={year} />}
      />

      <div className="flex items-center justify-between rounded-xl border bg-card p-4">
        <Button nativeButton={false} variant="ghost" size="icon" render={<Link href={`/reports?month=${prevDate.getMonth() + 1}&year=${prevDate.getFullYear()}`} />} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <p className="font-semibold">{monthLabel(month, year)}</p>
        <Button nativeButton={false} variant="ghost" size="icon" render={<Link href={`/reports?month=${nextDate.getMonth() + 1}&year=${nextDate.getFullYear()}`} />} aria-label="Next month">
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={formatCurrency(totalIncome)} icon={TrendingUp} accent="#22c55e" index={0} />
        <StatCard label="Expense" value={formatCurrency(totalExpense)} icon={TrendingDown} accent="#ef4444" index={1} />
        <StatCard label="Net Savings" value={formatCurrency(netSavings)} icon={PiggyBank} accent={netSavings >= 0 ? "#22c55e" : "#ef4444"} index={2} />
        <StatCard label="Savings Rate" value={`${savingsRate.toFixed(1)}%`} icon={Percent} accent="#8b5cf6" index={3} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>6-Month Cash Flow</CardTitle></CardHeader>
          <CardContent><CashFlowChart data={cashFlowData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expense by Category — {monthLabel(month, year)}</CardTitle></CardHeader>
          <CardContent><CategoryBreakdownChart data={categoryData} /></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Portfolio Value" value={formatCurrency(totalInvestmentValue)} icon={PiggyBank} accent="#3b82f6" index={0} />
        <StatCard label="Portfolio Gain/Loss" value={formatCurrency(investmentGain)} icon={investmentGain >= 0 ? TrendingUp : TrendingDown} accent={investmentGain >= 0 ? "#22c55e" : "#ef4444"} index={1} />
        <StatCard label="Owed to You" value={formatCurrency(lentOutstanding)} icon={TrendingUp} accent="#14b8a6" index={2} />
        <StatCard label="You Owe" value={formatCurrency(borrowedOutstanding)} icon={TrendingDown} accent="#f97316" index={3} />
      </div>

      <Card>
        <CardHeader><CardTitle>Transaction Mix — {monthLabel(month, year)}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="text-sm">{monthTx.filter((t) => t.type === "INCOME").length} Income entries</Badge>
            <Badge variant="secondary" className="text-sm">{monthTx.filter((t) => t.type === "EXPENSE").length} Expense entries</Badge>
            <Badge variant="secondary" className="text-sm">{monthTx.filter((t) => t.type === "TRANSFER").length} Transfers</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
