import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, TrendingDown, Receipt, Percent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeCardSpend } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { CARD_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { CardDialog } from "@/components/cards/card-dialog";

export const dynamic = "force-dynamic";

export default async function CardDetailPage({ params }: PageProps<"/cards/[id]">) {
  const { id } = await params;

  const [card, transactions, categories, cards, accounts] = await Promise.all([
    prisma.card.findUnique({ where: { id } }),
    prisma.transaction.findMany({
      where: { cardId: id },
      include: { category: true, card: true, bankAccount: true },
      orderBy: { date: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.card.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!card) notFound();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSpend = computeCardSpend(id, transactions, monthStart);
  const lifetimeSpend = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const utilization = card.creditLimit ? (monthSpend / card.creditLimit) * 100 : null;

  return (
    <div className="space-y-6">
      <div>
        <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/cards" />}>
          <ArrowLeft /> Back to Cards
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
            <Badge variant="secondary">{CARD_TYPE_LABELS[card.type]}</Badge>
            {!card.isActive && <Badge variant="outline">Inactive</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.bankName} {card.last4 && `· •••• ${card.last4}`}
          </p>
        </div>
        <div className="flex gap-2">
          <CardDialog card={card} trigger={<Button variant="outline" size="sm"><Pencil /> Edit</Button>} />
          <TransactionDialog
            categories={categories}
            cards={cards}
            accounts={accounts}
            defaultType="EXPENSE"
            trigger={<Button size="sm">Add Transaction</Button>}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="This Month Spend" value={formatCurrency(monthSpend)} icon={TrendingDown} accent={card.color ?? "#3b82f6"} />
        <StatCard label="Lifetime Spend" value={formatCurrency(lifetimeSpend)} icon={Receipt} accent="#64748b" />
        {utilization !== null && (
          <StatCard label="Credit Utilization" value={`${utilization.toFixed(0)}%`} icon={Percent} accent={utilization > 80 ? "#ef4444" : "#22c55e"} />
        )}
      </div>

      {card.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{card.notes}</CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Transactions</h2>
        <TransactionTable transactions={transactions} categories={categories} cards={cards} accounts={accounts} hideColumns={["card"]} />
      </div>
    </div>
  );
}
