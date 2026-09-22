import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeInvestmentGain } from "@/lib/calculations";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { InvestmentDialog } from "@/components/portfolio/investment-dialog";
import { UpdateValueDialog } from "@/components/portfolio/update-value-dialog";
import { ValueHistoryChart } from "@/components/portfolio/value-history-chart";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvestmentDetailPage({ params }: PageProps<"/portfolio/[id]">) {
  const { id } = await params;
  const [investment, accounts, cards] = await Promise.all([
    prisma.investment.findUnique({
      where: { id },
      include: { valueHistory: { orderBy: { date: "asc" } } },
    }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.card.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!investment) notFound();
  const { gain, gainPercent, current } = computeInvestmentGain(investment);
  const positive = gain >= 0;

  const historyPoints = [
    { date: investment.date, value: investment.amountInvested },
    ...investment.valueHistory.map((v) => ({ date: v.date, value: v.value })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/portfolio" />}>
          <ArrowLeft /> Back to Portfolio
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{investment.name}</h1>
            <Badge variant="secondary">{INSTRUMENT_TYPE_LABELS[investment.instrumentType]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {investment.platform} {investment.symbol && `· ${investment.symbol}`} · Invested {formatDate(investment.date)}
          </p>
        </div>
        <div className="flex gap-2">
          <InvestmentDialog investment={investment} accounts={accounts} cards={cards} trigger={<Button variant="outline" size="sm"><Pencil /> Edit</Button>} />
          <UpdateValueDialog investmentId={investment.id} currentValue={current} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Amount Invested" value={formatCurrency(investment.amountInvested)} icon={Wallet} accent="#3b82f6" />
        <StatCard label="Current Value" value={formatCurrency(current)} icon={positive ? TrendingUp : TrendingDown} accent={positive ? "#22c55e" : "#ef4444"} />
        <StatCard label="Gain / Loss" value={`${formatCurrency(gain)} (${formatPercent(gainPercent)})`} icon={positive ? TrendingUp : TrendingDown} accent={positive ? "#22c55e" : "#ef4444"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Value Over Time</CardTitle></CardHeader>
        <CardContent><ValueHistoryChart data={historyPoints} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {investment.units && <div className="flex justify-between"><span className="text-muted-foreground">Units</span><span>{investment.units}</span></div>}
            {investment.purchasePrice && <div className="flex justify-between"><span className="text-muted-foreground">Purchase Price</span><span>{formatCurrency(investment.purchasePrice)}</span></div>}
            {investment.maturityDate && <div className="flex justify-between"><span className="text-muted-foreground">Maturity Date</span><span>{formatDate(investment.maturityDate)}</span></div>}
          </CardContent>
        </Card>
        {investment.notes && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{investment.notes}</CardContent>
          </Card>
        )}
      </div>

      {investment.valueHistory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Value Update Log</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...investment.valueHistory].reverse().map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{formatDate(v.date)}</span>
                <span className={cn("font-medium tabular-nums")}>{formatCurrency(v.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
