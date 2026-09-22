import { Wallet, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeInvestmentGain } from "@/lib/calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { InvestmentDialog } from "@/components/portfolio/investment-dialog";
import { InvestmentTable } from "@/components/portfolio/investment-table";
import { AllocationChart } from "@/components/portfolio/allocation-chart";
import { ImportFromImageDialog } from "@/components/portfolio/import-from-image-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const [investments, accounts, cards] = await Promise.all([
    prisma.investment.findMany({ orderBy: { date: "desc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.card.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const totalInvested = investments.reduce((s, i) => s + i.amountInvested, 0);
  const totalCurrent = investments.reduce((s, i) => s + computeInvestmentGain(i).current, 0);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const allocationMap = new Map<string, number>();
  for (const inv of investments) {
    const current = computeInvestmentGain(inv).current;
    allocationMap.set(inv.instrumentType, (allocationMap.get(inv.instrumentType) ?? 0) + current);
  }
  const allocationData = [...allocationMap.entries()].map(([type, value]) => ({ type, value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="Every investment — stocks, mutual funds, crypto, gold, FDs and more — in one view."
        actions={
          <div className="flex gap-2">
            <ImportFromImageDialog accounts={accounts} cards={cards} />
            {investments.length > 0 && <InvestmentDialog accounts={accounts} cards={cards} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Invested" value={formatCurrency(totalInvested)} icon={Wallet} accent="#3b82f6" />
        <StatCard label="Current Value" value={formatCurrency(totalCurrent)} icon={TrendingUp} accent="#8b5cf6" />
        <StatCard
          label="Total Gain / Loss"
          value={formatCurrency(totalGain)}
          icon={totalGain >= 0 ? TrendingUp : TrendingDown}
          accent={totalGain >= 0 ? "#22c55e" : "#ef4444"}
        />
        <StatCard label="Overall Return" value={formatPercent(totalGainPercent)} icon={Percent} accent={totalGainPercent >= 0 ? "#22c55e" : "#ef4444"} />
      </div>

      {allocationData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Allocation by Instrument</CardTitle></CardHeader>
          <CardContent>
            <AllocationChart data={allocationData} />
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">All Investments</h2>
        <InvestmentTable investments={investments} accounts={accounts} cards={cards} />
      </div>
    </div>
  );
}
